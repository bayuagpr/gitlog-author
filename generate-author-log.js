#!/usr/bin/env node

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  blue: '\x1b[34m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  green: '\x1b[32m'
};

// Custom error class
class GitLogError extends Error {
  constructor(message, code, details = {}) {
    super(message);
    this.name = 'GitLogError';
    this.code = code;
    this.details = details;
  }
}

// Utility to execute git commands asynchronously
async function execGitCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    let output = '';
    let errorOutput = '';
    
    // Only allow git commands
    if (command !== 'git') {
      throw new GitLogError(
        'Only git commands are allowed',
        'INVALID_COMMAND',
        { command }
      );
    }

    // Use appropriate git executable for the platform
    const gitPath = process.platform === 'win32' ? 'git.exe' : 'git';
    const childProcess = spawn(gitPath, args, {
      ...options,
      env: {
        ...process.env,
        PATH: process.env.PATH,
        LANG: 'en_US.UTF-8',  // Ensure UTF-8 encoding
        LC_ALL: 'en_US.UTF-8',
        GIT_TERMINAL_PROMPT: '0'  // Disable git interactive prompts
      },
      windowsHide: true  // Hide the command window on Windows
    });
    
    childProcess.stdout.setEncoding('utf8');
    childProcess.stderr.setEncoding('utf8');
    
    childProcess.stdout.on('data', (data) => {
      output += data;
    });
    
    childProcess.stderr.on('data', (data) => {
      errorOutput += data;
    });

    childProcess.on('error', (error) => {
      if (error.code === 'ENOENT') {
        reject(new GitLogError(
          'Git is not installed or not in PATH',
          'GIT_NOT_FOUND',
          { error: error.message }
        ));
      } else {
        reject(new GitLogError(
          `Failed to execute git command: ${error.message}`,
          'GIT_EXECUTION_ERROR',
          { error: error.message }
        ));
      }
    });
    
    childProcess.on('close', (code) => {
      if (code === 0) {
        resolve(output);
      } else {
        const errorMsg = errorOutput.trim();
        if (errorMsg.includes('not a git repository')) {
          reject(new GitLogError(
            'Not a git repository. Please run this command from within a git repository.',
            'NOT_GIT_REPO'
          ));
        } else if (errorMsg.includes('bad revision')) {
          reject(new GitLogError(
            'Invalid git reference or commit hash',
            'INVALID_GIT_REF',
            { command: `${command} ${args.join(' ')}` }
          ));
        } else {
          reject(new GitLogError(
            `Git command failed: ${errorMsg || 'Unknown error'}`,
            'GIT_OPERATION_FAILED',
            { command: `${command} ${args.join(' ')}`, code }
          ));
        }
      }
    });
  });
}

function sanitizeFilename(filename) {
  return filename
    .replace(/[\/\\?%*:|"<>]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 255);
}

// Simple LRU cache implementation
class LRUCache {
  constructor(maxSize = 100) {
    this.maxSize = maxSize;
    this.cache = new Map();
  }

  get(key) {
    if (!this.cache.has(key)) return null;
    // Refresh the item
    const value = this.cache.get(key);
    this.cache.delete(key);
    this.cache.set(key, value);
    return value;
  }

  set(key, value) {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      // Remove the oldest item
      this.cache.delete(this.cache.keys().next().value);
    }
    this.cache.set(key, value);
  }
}

// Cache for commit messages
const commitCache = new LRUCache(1000);

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
      escapeRegex(authorName), // Exact match with escaped special chars
      authorName.includes('@') 
        ? escapeRegex(authorName) // For email, keep exact match
        : authorName.split(' ').map(escapeRegex).join('.*'), // For names, allow flexible spacing
      authorName.includes('@')
        ? escapeRegex(authorName)
        : `${authorName.split(' ').map(escapeRegex).join('.*')}|${escapeRegex(authorName)}` // Fuzzy or exact match for names
    ];

    let output = '';
    for (const pattern of authorPatterns) {
      const args = [
        'log',
        '--author=' + pattern,
        '--date=iso',
        '--pretty=format:"%H|%aI"',  // Keep original format for safety
        '--no-merges',
        '--no-notes',  // Optimization: skip notes
        '--first-parent',  // Optimization: simplify history
        '--all',  // Include commits from all branches
        '--date-order'  // Ensure consistent date-based ordering
      ];

      if (since) args.push(`--since=${since}`);
      if (until) args.push(`--until=${until}`);
      
      // Add case-insensitive flag for the last pattern
      if (pattern === authorPatterns[2]) {
        args.push('-i');
      }

      try {
        output = await execGitCommand('git', args);
        if (output.trim()) break;
      } catch (error) {
        // Continue trying other patterns if this one fails
        continue;
      }
    }

    if (!output.trim()) {
      return [];
    }

    // Process commits in batches of 50 for better memory management
    const commits = output.split('\n').filter(line => line.trim());
    const batchSize = 50;
    const results = [];

    process.stdout.write(`${colors.dim}Fetching commit details...${colors.reset}\r`);
    for (let i = 0; i < commits.length; i += batchSize) {
      const batch = commits.slice(i, i + batchSize);
      const progress = Math.min(((i + batchSize) / commits.length) * 100, 100).toFixed(0);
      process.stdout.write(`${colors.dim}Fetching commit details: ${progress}%${colors.reset}\r`);
      const batchResults = await Promise.all(batch.map(async line => {
        const sanitizedLine = line.replace(/\n/g, ' ');
        const [hash, date] = sanitizedLine.split('|');

        if (!hash || !date) {
          throw new GitLogError(
            'Invalid git log output format',
            'INVALID_LOG_FORMAT',
            { line }
          );
        }

        const cleanHash = hash.replace(/"/g, '');

        // Check cache first for commit message
        const cachedMessage = commitCache.get(cleanHash);
        if (cachedMessage !== null) {
          const [subject, body] = cachedMessage;
          return {
            hash: cleanHash,
            date: date.replace(/"/g, ''),
            subject,
            body
          };
        }

        // Get commit subject and body if not in cache
        const messageArgs = [
          'show',
          '-s',  // suppress diff output
          '--format=%s|%b',  // %s=subject, %b=body
          '--no-notes',  // Optimization: skip notes
          cleanHash
        ];

        try {
          const messageOutput = await execGitCommand('git', messageArgs);
          const [subject, ...bodyParts] = messageOutput.split('|');
          const body = bodyParts.join('|').trim();  // Rejoin in case body contained | character
          
          // Cache the message
          commitCache.set(cleanHash, [subject || '', body || '']);
          
          return {
            hash: cleanHash,
            date: date.replace(/"/g, ''),
            subject: subject || '',
            body: body || ''
          };
        } catch (error) {
          return {
            hash: cleanHash,
            date: date.replace(/"/g, ''),
            subject: '',
            body: ''
          };
        }
      }));

      results.push(...batchResults);

      // Optional: Add a small delay between batches to prevent overwhelming the system
      if (i + batchSize < commits.length) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }
    process.stdout.write('\n'); // Clear the progress line

    // Final sort of all results to ensure consistent ordering
    return results;
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

function isValidDateFormat(date) {
  // Git supports various date formats:
  // - ISO 8601 (2023-01-01)
  // - Relative dates (1 week ago, yesterday)
  // - Named dates (last monday, last month)
  return date.trim().length > 0 && 
    !date.match(/[<>|&;$]/); // Basic security check for shell injection
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
      '--no-notes',  // Optimization: skip notes
      '--no-abbrev-commit',  // Use full commit hash
      '--no-walk',  // Don't traverse into submodules
      '--first-parent'  // Optimization: simplify history
    ];

    const details = await execGitCommand('git', args);
    if (!details.trim()) {
      throw new GitLogError(
        'No details found for commit',
        'COMMIT_NOT_FOUND',
        { hash }
      );
    }

    // Cache the result
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

async function isGitRepository() {
  try {
    // Check if we're in a git repository
    await execGitCommand('git', ['rev-parse', '--is-inside-work-tree']);
    
    // Check if repository has any commits
    try {
      // Try HEAD first, fall back to --all if that fails
      let output;
      try {
        output = await execGitCommand('git', ['rev-list', '--count', 'HEAD']);
      } catch (error) {
        output = await execGitCommand('git', ['rev-list', '--count', '--all']);
      }
      if (parseInt(output.trim(), 10) === 0) {
        throw new GitLogError(
          'Git repository has no commits yet',
          'EMPTY_REPOSITORY'
        );
      }
      return true;
    } catch (error) {
      if (error instanceof GitLogError && error.code === 'GIT_OPERATION_FAILED') {
        // Repository exists but has no commits
        throw new GitLogError(
          'Git repository has no commits yet',
          'EMPTY_REPOSITORY'
        );
      }
      throw error;
    }
  } catch (error) {
    if (error instanceof GitLogError && error.code === 'EMPTY_REPOSITORY') {
      throw error;
    }
    if (error instanceof GitLogError && error.code === 'NOT_GIT_REPO') {
      return false;
    }
    throw error;
  }
}

async function generateAuthorLog(author, since = '', until = '') {
  try {
    // Check if current directory is a git repository
    if (!await isGitRepository()) {
      throw new GitLogError(
        'Not a git repository. Please run this command from within a git repository.',
        'NOT_GIT_REPO'
      );
    }

    // Verify git command works
    try {
      await execGitCommand('git', ['--version']);
    } catch (error) {
      throw new GitLogError(
        'Failed to execute git command. Please ensure git is installed and accessible.',
        'GIT_NOT_AVAILABLE',
        { error: error.message }
      );
    }

    console.log(`${colors.blue}Fetching commits for author: ${colors.bright}${author}${colors.reset}`);
    
    const commits = await getAuthorCommits(author, since, until);
    console.log(`${colors.green}✓ Found ${colors.bright}${commits.length}${colors.reset}${colors.green} commits${colors.reset}`);
    
    if (!commits.length) {
      console.log(`${colors.yellow}No commits found for author: ${author}${colors.reset}`);
      return;
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outputDir = path.join(process.cwd(), 'git-logs');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const outputFile = path.join(outputDir, `${sanitizeFilename(author)}_${timestamp}.md`);
    const writeStream = fs.createWriteStream(outputFile);

    // Write header
    writeStream.write(`# Git Log for ${author}\n\n`);
    writeStream.write(`Generated on: ${new Date().toLocaleString('en-US', { timeZoneName: 'short' })}\n\n`);
    
    if (since || until) {
      writeStream.write('## Date Range\n');
      if (since) writeStream.write(`From: ${since}\n`);
      if (until) writeStream.write(`To: ${until}\n`);
      writeStream.write('\n');
    }

    writeStream.write('## Commits\n\n');

    console.log(`${colors.blue}Processing commits and generating log file...${colors.reset}`);
    
    // Process commits in chunks while maintaining order
    const chunkSize = 15;
    for (let i = 0; i < commits.length; i += chunkSize) {
      const chunk = commits.slice(i, Math.min(i + chunkSize, commits.length));
      const progress = Math.min(((i + chunk.length) / commits.length) * 100, 100).toFixed(0);
      process.stdout.write(`${colors.dim}Progress: ${progress}%${colors.reset}\r`);
      
      // Process chunk in parallel but write sequentially
      const chunkResults = await Promise.all(chunk.map(async commit => {
        const commitContent = [];
        
        const escapedSubject = commit.subject.replace(/([_*`#])/g, '\\$1');
        commitContent.push(`### ${escapedSubject}\n`);
        commitContent.push(`**Date:** ${new Date(commit.date).toLocaleString('en-US', { timeZoneName: 'short' })}\n`);
        commitContent.push(`**Hash:** \`${commit.hash}\`\n\n`);

        if (commit.body.trim()) {
          const escapedBody = commit.body.trim()
            .split('\n')
            .map(line => `> ${line.replace(/([_*`#>])/g, '\\$1').trim()}`)
            .join('\n');
          commitContent.push('**Description:**\n');
          commitContent.push(escapedBody);
          commitContent.push('\n\n');
        }

        // Get commit details with caching
        const details = await getCommitDetails(commit.hash);
        if (details.trim()) {
          commitContent.push('**Changes:**\n```\n');
          commitContent.push(details.trim());
          commitContent.push('\n```\n\n');
        }

        commitContent.push('---\n\n');
        return commitContent.join('');
      }));

      // Write chunk results sequentially
      for (const content of chunkResults) {
        writeStream.write(content);
      }
    }

    // Close the write stream properly
    await new Promise((resolve, reject) => {
      writeStream.end(err => {
        if (err) reject(err);
        else resolve();
      });
    });

    process.stdout.write('\n'); // Clear the progress line
    console.log(`${colors.green}✓ Generated log file: ${colors.reset}${outputFile}`);
    
    return outputFile;
  } catch (error) {
    if (error instanceof GitLogError) {
      throw error;
    }
    throw new GitLogError(
      'Error generating author log: ' + error.message,
      'GIT_OPERATION_FAILED',
      { error: error.message }
    );
  }
}

async function main() {
  try {
    const args = process.argv.slice(2);
    
    if (args.includes('--help') || args.includes('-h') || args.length === 0) {
      console.log(`
${colors.bright}Generate Git Log by Author${colors.reset}

Usage: node generate-author-log.js <author> [--since=<date>] [--until=<date>]

Arguments:
  author         Author name or email to filter commits by

Options:
  --since=<date> Show commits more recent than a specific date
  --until=<date> Show commits older than a specific date
  --help, -h     Show this help message

Examples:
  node generate-author-log.js "John Doe"
  node generate-author-log.js "john@example.com" --since="1 week ago"
  node generate-author-log.js "John Doe" --since="2023-01-01" --until="2023-12-31"
      `);
      return;
    }

    const author = args[0];
    const sinceArg = args.find(arg => arg.startsWith('--since='));
    const untilArg = args.find(arg => arg.startsWith('--until='));

    const since = sinceArg ? sinceArg.split('=')[1] : '';
    const until = untilArg ? untilArg.split('=')[1] : '';

    await generateAuthorLog(author, since, until);
  } catch (error) {
    if (error instanceof GitLogError) {
      console.error(`${colors.red}Error: ${error.message}${colors.reset}`);
    } else {
      console.error(`${colors.red}Unexpected error: ${error.message}${colors.reset}`);
    }
    process.exit(1);
  }
}

main();

// Export for testing
module.exports = {
  GitLogError,
  sanitizeFilename,
  isValidDateFormat,
  LRUCache,
  execGitCommand,
  isGitRepository,
  getAuthorCommits,
  getCommitDetails
};
