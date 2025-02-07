/**
 * @module gitOperations
 * @description Core service for executing git commands and managing git repository operations
 */

const { spawn } = require('child_process');
const GitLogError = require('../models/GitLogError');

/**
 * Executes a git command with the provided arguments
 * @async
 * @param {string} command - The git command to execute (must be 'git')
 * @param {Array<string>} args - Array of command arguments
 * @param {Object} [options={}] - Spawn options for child process
 * @returns {Promise<string>} Command output
 * @throws {GitLogError} If command execution fails, git is not found, or repository errors occur
 */
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

/**
 * Checks if the current directory is within a valid git repository with commits
 * @async
 * @returns {Promise<boolean>} True if directory is in a valid git repository
 * @throws {GitLogError} If repository exists but is empty or other git errors occur
 */
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

/**
 * Attempts to fetch latest changes from all remotes
 * @async
 * @returns {Promise<boolean>} True if fetch was successful, false otherwise
 */
async function fetchLatestChanges() {
  try {
    await execGitCommand('git', ['fetch', '--all']);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Gets the diff of a commit.
 * @async
 * @param {string} hash - The hash of the commit to get the diff for.
 * @param {string} [parentHash=null] - The hash of the parent commit to compare against. If not provided, compares with the parent of the given commit.
 * @returns {Promise<string>} The diff output.
 * @throws {Error} If the git command fails.
 */
async function getCommitDiff(hash, parentHash = null, { stream = false } = {}) {
  const args = ['diff', '--color=never'];
  
  if (parentHash) {
    args.push(`${parentHash}..${hash}`);
  } else {
    args.push(`${hash}^..${hash}`); // Compare with parent
  }

  try {
    if (stream) {
      // Return stdout stream directly for streaming processing
      const gitPath = process.platform === 'win32' ? 'git.exe' : 'git';
      const childProcess = spawn(gitPath, args, {
        env: {
          ...process.env,
          LANG: 'en_US.UTF-8',
          LC_ALL: 'en_US.UTF-8',
          GIT_TERMINAL_PROMPT: '0'
        }
      });
      return childProcess.stdout;
    } else {
      // Original behavior for backward compatibility
      const output = await execGitCommand('git', args);
      return output;
    }
  } catch (error) {
    if (error.message?.includes('bad revision')) {
      // Handle first commit case
      if (stream) {
        const gitPath = process.platform === 'win32' ? 'git.exe' : 'git';
        const childProcess = spawn(gitPath, ['show', '--color=never', hash], {
          env: {
            ...process.env,
            LANG: 'en_US.UTF-8',
            LC_ALL: 'en_US.UTF-8',
            GIT_TERMINAL_PROMPT: '0'
          }
        });
        return childProcess.stdout;
      } else {
        const rootDiff = await execGitCommand('git', ['show', '--color=never', hash]);
        return rootDiff;
      }
    }
    throw error;
  }
}

/**
 * Gets the current branch name
 * @async
 * @returns {Promise<string>} Current branch name
 * @throws {GitLogError} If command fails
 */
async function getCurrentBranch() {
  try {
    const output = await execGitCommand('git', ['rev-parse', '--abbrev-ref', 'HEAD']);
    return output.trim();
  } catch (error) {
    throw new GitLogError(
      'Failed to get current branch: ' + error.message,
      'GIT_BRANCH_ERROR',
      { error: error.message }
    );
  }
}

/**
 * Creates a new branch and cherry-picks commits
 * @async
 * @param {string} branchName - Name of the branch to create
 * @param {string[]} commits - Array of commit hashes to cherry-pick
 * @param {string} [startPoint] - Starting point for the branch
 * @returns {Promise<void>}
 * @throws {GitLogError} If branch creation or cherry-pick fails
 */
async function createReviewBranch(branchName, commits, startPoint = null) {
  try {
    console.log(`Starting to create review branch: ${branchName}`);
    if (!commits || commits.length === 0) {
      throw new GitLogError('No commits to review', 'NO_COMMITS_TO_REVIEW');
    }

    // Create new branch
    const createArgs = ['checkout', '-b', branchName];
    if (startPoint) createArgs.push(startPoint);
    await execGitCommand('git', createArgs);

    // Cherry-pick commits individually in reverse order (oldest to newest)
    const sortedCommits = [...commits].reverse();
    for (const commit of sortedCommits) {
      try {
        await execGitCommand('git', ['cherry-pick', '--allow-empty', commit]);
      } catch (cherryError) {
        // Abort cherry-pick and clean up on conflict
        await execGitCommand('git', ['cherry-pick', '--abort']);
        await cleanupReviewBranch(branchName, startPoint || 'main');
        throw new GitLogError(
          `Cherry-pick failed on commit ${commit}: ${cherryError.message}`,
          'CHERRY_PICK_CONFLICT',
          { commit, error: cherryError.message }
        );
      }
    }
  } catch (error) {
    if (error instanceof GitLogError) throw error;
    throw new GitLogError(
      'Failed to create review branch: ' + error.message,
      'BRANCH_CREATION_FAILED',
      { error: error.message }
    );
  }
}

/**
 * Gets diff between two branches or commits
 * @async
 * @param {string} base - Base branch/commit
 * @param {string} compare - Branch/commit to compare against base
 * @param {Object} [options] - Options for diff
 * @param {boolean} [options.stream=false] - Return a readable stream instead of string
 * @returns {Promise<string|Readable>} Diff output or readable stream
 * @throws {GitLogError} If diff fails
 */
async function getBranchDiff(base, compare, { stream = false } = {}) {
  const args = ['diff', '--color=never', `${base}...${compare}`];
  
  try {
    if (stream) {
      const gitPath = process.platform === 'win32' ? 'git.exe' : 'git';
      const childProcess = spawn(gitPath, args, {
        env: {
          ...process.env,
          LANG: 'en_US.UTF-8',
          LC_ALL: 'en_US.UTF-8',
          GIT_TERMINAL_PROMPT: '0'
        }
      });
      return childProcess.stdout;
    } else {
      const output = await execGitCommand('git', args);
      return output;
    }
  } catch (error) {
    throw new GitLogError(
      'Failed to get branch diff: ' + error.message,
      'DIFF_FAILED',
      { base, compare, error: error.message }
    );
  }
}

/**
 * Cleans up a review branch
 * @async
 * @param {string} branchName - Name of branch to delete
 * @param {string} returnBranch - Branch to checkout after deletion
 * @returns {Promise<void>}
 * @throws {GitLogError} If cleanup fails
 */
async function cleanupReviewBranch(branchName, returnBranch) {
  try {
    // Switch to return branch
    await execGitCommand('git', ['checkout', returnBranch]);
    // Delete review branch
    await execGitCommand('git', ['branch', '-D', branchName]);
  } catch (error) {
    throw new GitLogError(
      'Failed to cleanup review branch: ' + error.message,
      'CLEANUP_FAILED',
      { branch: branchName, error: error.message }
    );
  }
}

module.exports = {
  execGitCommand,
  isGitRepository,
  fetchLatestChanges,
  getCommitDiff,
  getCurrentBranch,
  createReviewBranch,
  getBranchDiff,
  cleanupReviewBranch
};
