const { spawn } = require('child_process');
const GitLogError = require('../models/GitLogError');

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

async function fetchLatestChanges() {
  try {
    await execGitCommand('git', ['fetch', '--all']);
    return true;
  } catch (error) {
    return false;
  }
}

module.exports = {
  execGitCommand,
  isGitRepository,
  fetchLatestChanges
}; 