const { execGitCommand } = require('./gitOperations');
const LRUCache = require('../utils/cache');
const GitLogError = require('../models/GitLogError');

// Cache for commit messages
const commitCache = new LRUCache(1000);

function isValidDateFormat(date) {
  return date.trim().length > 0 && 
    !date.match(/[<>|&;$]/); // Basic security check for shell injection
}

async function getAllAuthors() {
  try {
    const output = await execGitCommand('git', [
      'shortlog',
      '-sne',
      '--all',
      '--no-merges',
      '--first-parent'
    ]);
    if (!output.trim()) {
      return [];
    }

    // Parse the output into structured data
    const authors = output.split('\n')
      .filter(line => line.trim())
      .map(line => {
        // Format is: "commits\tAuthor Name <email@example.com>"
        const match = line.trim().match(/^\s*(\d+)\s+(.+)\s+<(.+)>$/);
        if (!match) return null;
        
        return {
          commits: parseInt(match[1], 10),
          name: match[2].trim(),
          email: match[3].trim()
        };
      })
      .filter(author => author !== null);

    return authors;
  } catch (error) {
    if (error instanceof GitLogError) {
      throw error;
    }
    throw new GitLogError(
      'Failed to get authors list: ' + error.message,
      'GIT_OPERATION_FAILED',
      { error: error.message }
    );
  }
}

async function getAuthorCommits(author, since = '', until = '') {
  try {
    if (!author?.trim()) {
      throw new GitLogError(
        'Author name or email is required',
        'INVALID_AUTHOR'
      );
    }

    // Validate date formats first
    if (since && !isValidDateFormat(since)) {
      throw new GitLogError(
        'Invalid --since date format',
        'INVALID_DATE_FORMAT',
        { date: since }
      );
    }

    if (until && !isValidDateFormat(until)) {
      throw new GitLogError(
        'Invalid --until date format',
        'INVALID_DATE_FORMAT',
        { date: until }
      );
    }

    // Escape special regex characters in the author name
    const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const authorName = author.trim();
    
    // Try different author matching strategies
    const authorPatterns = [
      escapeRegex(authorName),
      authorName.includes('@') 
        ? escapeRegex(authorName)
        : authorName.split(' ').map(escapeRegex).join('.*'),
      authorName.includes('@')
        ? escapeRegex(authorName)
        : `${authorName.split(' ').map(escapeRegex).join('.*')}|${escapeRegex(authorName)}`
    ];

    let output = '';
    for (const pattern of authorPatterns) {
      const args = [
        'log',
        '--author=' + pattern,
        '--date=iso',
        '--pretty=format:"%H|%aI"',
        '--no-merges',
        '--no-notes',
        '--first-parent',
        '--all',
        '--date-order'
      ];

      if (since) args.push(`--since=${since}`);
      if (until) args.push(`--until=${until}`);
      
      if (pattern === authorPatterns[2]) {
        args.push('-i');
      }

      try {
        output = await execGitCommand('git', args);
        if (output.trim()) break;
      } catch (error) {
        continue;
      }
    }

    if (!output.trim()) {
      return [];
    }

    const commits = output.split('\n').filter(line => line.trim());
    const batchSize = 50;
    const results = [];

    for (let i = 0; i < commits.length; i += batchSize) {
      const batch = commits.slice(i, i + batchSize);
      const batchResults = await Promise.all(batch.map(async line => {
        const [hash, date] = line.replace(/"/g, '').split('|');
        
        // Check cache first for commit message
        const cachedMessage = commitCache.get(hash);
        if (cachedMessage !== null) {
          const [subject, body] = cachedMessage;
          return { hash, date, subject, body };
        }

        // Get commit subject and body if not in cache
        const messageArgs = [
          'show',
          '-s',
          '--format=%s|%b',
          '--no-notes',
          hash
        ];

        try {
          const messageOutput = await execGitCommand('git', messageArgs);
          const [subject, ...bodyParts] = messageOutput.split('|');
          const body = bodyParts.join('|').trim();
          
          commitCache.set(hash, [subject || '', body || '']);
          
          return {
            hash,
            date,
            subject: subject || '',
            body: body || ''
          };
        } catch (error) {
          return { hash, date, subject: '', body: '' };
        }
      }));

      results.push(...batchResults);

      // Optional: Add a small delay between batches
      if (i + batchSize < commits.length) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }

    return results.sort((a, b) => new Date(b.date) - new Date(a.date));
  } catch (error) {
    if (error instanceof GitLogError) {
      throw error;
    }
    throw new GitLogError(
      'Failed to get author commits: ' + error.message,
      'GIT_OPERATION_FAILED',
      { error: error.message }
    );
  }
}

async function getCommitDetails(hash) {
  try {
    if (!hash?.match(/^[0-9a-f]+$/i)) {
      throw new GitLogError(
        'Invalid commit hash format',
        'INVALID_HASH_FORMAT',
        { hash }
      );
    }

    // Check cache first
    const cachedDetails = commitCache.get(`details_${hash}`);
    if (cachedDetails !== null) {
      return cachedDetails;
    }

    const args = [
      'show',
      hash,
      '--stat',
      '--pretty=format:%b',
      '--no-color',
      '--no-notes',
      '--no-abbrev-commit',
      '--no-walk',
      '--first-parent'
    ];

    const details = await execGitCommand('git', args);
    if (!details.trim()) {
      throw new GitLogError(
        'No details found for commit',
        'COMMIT_NOT_FOUND',
        { hash }
      );
    }

    commitCache.set(`details_${hash}`, details);
    return details;
  } catch (error) {
    if (error instanceof GitLogError) {
      throw error;
    }
    throw new GitLogError(
      'Failed to get commit details: ' + error.message,
      'GIT_OPERATION_FAILED',
      { hash, error: error.message }
    );
  }
}

module.exports = {
  getAllAuthors,
  getAuthorCommits,
  getCommitDetails,
  isValidDateFormat
}; 