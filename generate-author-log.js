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
        '--pretty=format:"%H|%aI"',  // Added quotes around the format
        '--no-merges',
        '--all'  // Include commits from all branches
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

    return await Promise.all(output.split('\n')
      .filter(line => line.trim())
      .map(async line => {
        // Replace newlines in the commit message with spaces
        const sanitizedLine = line.replace(/\n/g, ' ');
        const [hash, date] = sanitizedLine.split('|');

        if (!hash || !date) {
          throw new GitLogError(
            'Invalid git log output format',
            'INVALID_LOG_FORMAT',
            { line }
          );
        }

        // Get commit subject and body
        const messageArgs = [
          'show',
          '-s',  // suppress diff output
          '--format=%s|%b',  // %s=subject, %b=body
          hash.replace(/"/g, '')  // Remove quotes from hash
        ];

        try {
          const messageOutput = await execGitCommand('git', messageArgs);
          const [subject, ...bodyParts] = messageOutput.split('|');
          const body = bodyParts.join('|').trim();  // Rejoin in case body contained | character
          return { 
            hash: hash.replace(/"/g, ''), 
            date: date.replace(/"/g, ''), 
            subject: subject || '', 
            body: body || '' 
          };
        } catch (error) {
          // If we can't get the message, return with empty subject/body
          return { 
            hash: hash.replace(/"/g, ''), 
            date: date.replace(/"/g, ''), 
            subject: '', 
            body: '' 
          };
        }
      }));
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

    const args = [
      'show',
      hash,
      '--stat',
      '--pretty=format:%b',
      '--no-color',
      '--no-abbrev-commit',  // Use full commit hash
      '--no-walk'  // Don't traverse into submodules
    ];

    const details = await execGitCommand('git', args);
    if (!details.trim()) {
      throw new GitLogError(
        'No details found for commit',
        'COMMIT_NOT_FOUND',
        { hash }
      );
    }

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
    let markdown = `# Git Log for ${author}\n\n`;
    markdown += `Generated on: ${new Date().toLocaleString('en-US', { timeZoneName: 'short' })}\n\n`;
    
    if (since || until) {
      markdown += '## Date Range\n';
      if (since) markdown += `From: ${since}\n`;
      if (until) markdown += `To: ${until}\n`;
      markdown += '\n';
    }

    markdown += '## Commits\n\n';

    for (const commit of commits) {
      // Escape markdown special characters in subject
      const escapedSubject = commit.subject.replace(/([_*`#])/g, '\\$1');
      markdown += `### ${escapedSubject}\n`;
      markdown += `**Date:** ${commit.date}\n`;
      markdown += `**Hash:** \`${commit.hash}\`\n\n`;

      if (commit.body.trim()) {
        const escapedBody = commit.body.trim()
          .split('\n')
          .map(line => 
            // Escape markdown special characters and ensure proper quote formatting
            `> ${line.replace(/([_*`#>])/g, '\\$1').trim()}`
          )
          .join('\n');
        markdown += '**Description:**\n';
        markdown += escapedBody;
        markdown += '\n\n';
      }

      const details = await getCommitDetails(commit.hash);
      if (details.trim()) {
        markdown += '**Changes:**\n```\n';
        markdown += details.trim();
        markdown += '\n```\n\n';
      }

      markdown += '---\n\n';
    }

    fs.writeFileSync(outputFile, markdown);
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
