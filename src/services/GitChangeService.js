const { getCommitDiff } = require('./gitOperations');

/**
 * Service for handling Git commit changes and diffs
 */
class GitChangeService {
  /**
   * Creates a new GitChangeService instance with an empty diff cache
   */
  constructor() {
    this.diffCache = new Map();
  }

  /**
   * Retrieves the diff for a specific commit hash, using cache if available
   * @param {string} hash - The commit hash
   * @returns {Promise<string>} The commit diff
   */
  /**
   * Retrieves the diff for a specific commit hash, using cache if available
   * @param {string} hash - The commit hash
   * @param {Object} [options={}] - Options for getting the diff
   * @param {boolean} [options.stream=false] - Whether to return a readable stream instead of string
   * @returns {Promise<string|Readable>} The commit diff or readable stream
   */
  async getCommitDiff(hash, { stream = false } = {}) {
    if (stream) {
      // Don't use cache for streaming
      return getCommitDiff(hash, null, { stream: true });
    }

    if (this.diffCache.has(hash)) {
      return this.diffCache.get(hash);
    }
    const diff = await getCommitDiff(hash);
    this.diffCache.set(hash, diff);
    return diff;
  }

  /**
   * Categorizes file changes in a commit into added, modified, deleted, and renamed
   * @param {Object} commit - The commit object
   * @param {string} commit.hash - The commit hash
   * @param {Object} [options={}] - Options for categorizing changes
   * @param {boolean} [options.stream=false] - Whether to use streaming for processing diffs
   * @returns {Promise<Object>} Object containing categorized file changes
   */
  async categorizeFileChanges(commit, { stream = false } = {}) {
    const changes = {
      added: new Map(),
      modified: new Map(),
      deleted: new Map(),
      renamed: new Map()
    };

    let currentFile = null;
    let currentType = null;
    let currentHunk = [];
    let isInDiff = false;
    let fullDiff = '';

    const processDiffLine = (line) => {
      if (line.startsWith('diff --git')) {
        if (currentFile && currentHunk.length > 0) {
          this.addFileChange(changes, currentType, currentFile, [currentHunk]);
        }
        const [status, newFile] = this.parseFileStatus(line, fullDiff);
        currentFile = newFile;
        currentType = status;
        currentHunk = [];
        isInDiff = false;
      } else if (line.startsWith('@@ ')) {
        if (currentHunk.length > 0) {
          this.addFileChange(changes, currentType, currentFile, [currentHunk]);
          currentHunk = [];
        }
        currentHunk = [line];
        isInDiff = true;
      } else if (isInDiff) {
        if (line.startsWith('+') || line.startsWith('-') || line.startsWith(' ')) {
          currentHunk.push(line);
        }
      }

      // Process chunks periodically to avoid memory buildup
      if (currentHunk.length > 1000) {
        this.addFileChange(changes, currentType, currentFile, [currentHunk]);
        currentHunk = [];
      }
    };

    if (stream) {
      const diffStream = await this.getCommitDiff(commit.hash, { stream: true });
      let buffer = '';

      return new Promise((resolve, reject) => {
        diffStream.on('data', (chunk) => {
          buffer += chunk;
          fullDiff += chunk;
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // Keep the last partial line in buffer
          
          for (const line of lines) {
            processDiffLine(line);
          }
        });

        diffStream.on('end', () => {
          if (buffer) {
            processDiffLine(buffer);
          }
          if (currentFile && currentHunk.length > 0) {
            this.addFileChange(changes, currentType, currentFile, [currentHunk]);
          }
          resolve(changes);
        });

        diffStream.on('error', reject);
      });
    } else {
      const diff = await this.getCommitDiff(commit.hash);
      fullDiff = diff;
      const lines = diff.split('\n');

      for (const line of lines) {
        processDiffLine(line);
      }

      if (currentFile && currentHunk.length > 0) {
        this.addFileChange(changes, currentType, currentFile, [currentHunk]);
      }

      return changes;
    }
  }

  /**
   * Adds a file change to the appropriate category in the changes object
   * @param {Object} changes - The changes object containing all categories
   * @param {string} type - The type of change (added, modified, deleted, renamed)
   * @param {string} file - The file path
   * @param {Array<Array<string>>} hunks - Array of diff hunks
   * @private
   */
  addFileChange(changes, type, file, hunks) {
    if (!changes[type].has(file)) {
      changes[type].set(file, hunks);
    } else {
      changes[type].get(file).push(...hunks);
    }
  }

  /**
   * Parses the file status from a diff line
   * @param {string} diffLine - The diff line starting with 'diff --git'
   * @param {string} fullDiff - The complete diff content
   * @returns {[string, string]} Tuple of [status, filename]
   * @private
   */
  parseFileStatus(diffLine, fullDiff) {
    const oldFile = diffLine.match(/a\/(.+?)\s+b\//)?.[1];
    const newFile = diffLine.match(/b\/(.+?)$/)?.[1];

    if (fullDiff.includes('\nnew file mode ')) {
      return ['added', newFile];
    } else if (fullDiff.includes('\ndeleted file mode ')) {
      return ['deleted', oldFile];
    } else if (oldFile !== newFile && oldFile && newFile) {
      return ['renamed', `${oldFile} → ${newFile}`];
    } else {
      return ['modified', newFile];
    }
  }

  /**
   * Processes multiple commits in batches to categorize their changes
   * @param {Array<Object>} commits - Array of commit objects
   * @param {Object} [options={}] - Options for processing commits
   * @param {boolean} [options.stream=false] - Whether to use streaming for processing diffs
   * @returns {Promise<Map<string, Object>>} Map of commit hashes to their categorized changes
   */
  async batchProcessCommits(commits, { stream = false } = {}) {
    // Process commits in parallel with a concurrency limit
    const BATCH_SIZE = 3;
    const results = new Map();
    
    for (let i = 0; i < commits.length; i += BATCH_SIZE) {
      const batch = commits.slice(i, i + BATCH_SIZE);
      const promises = batch.map(commit => 
        this.categorizeFileChanges(commit, { stream })
          .then(changes => results.set(commit.hash, changes))
      );
      
      await Promise.all(promises);
    }
    
    return results;
  }

  /**
   * Clears the diff cache
   */
  clearCache() {
    this.diffCache.clear();
  }
}

module.exports = GitChangeService;
