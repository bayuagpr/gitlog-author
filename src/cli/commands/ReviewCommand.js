// src/cli/commands/ReviewCommand.js

const CommandHandler = require('./CommandHandler');
const ReportWriter = require('../writers/ReportWriter');
const { colors, RISK_PATTERNS, FILE_PATTERNS } = require('../../constants');
const { isGitRepository, getCommitDiff, getBranchDiff, cleanupReviewBranch, getCurrentBranch, createReviewBranch } = require('../../services/gitOperations');
const { getAuthorCommits } = require('../../services/authorService');
const GitLogError = require('../../models/GitLogError');

/**
 * Command to generate a detailed code review report for a specific author's commits
 * @extends CommandHandler
 */
class ReviewCommand extends CommandHandler {
  /**
   * Creates a new ReviewCommand instance
   * @param {string[]} args - Command line arguments
   * @param {string} args[0] - Author name or email
   */
  constructor(args) {
    super(args);
    this.author = args[0];
    this.since = this.getArg('since', '1 day ago');
    this.until = this.getArg('until', 'now');
    this.maxDiffContext = parseInt(this.getArg('context', '5'), 10);
    this.writer = new ReportWriter();
    this.riskPatterns = RISK_PATTERNS;
    this.filePatterns = FILE_PATTERNS;

    // Branch-related options
    this.createBranch = args.includes('--create-branch');
    this.cleanup = !args.includes('--no-cleanup');
    this.branchName = this.getArg('branch-name', null);
    this.baseCommit = this.getArg('base-commit', null);
  }

  /**
   * Validates command arguments
   * @throws {GitLogError} If author is not provided
   */
  validateArgs() {
    if (!this.author) {
      throw new GitLogError('Author name or email is required', 'INVALID_AUTHOR');
    }
  }

  /**
   * Determines the risk level of changes based on file patterns and content
   * @param {string} file - File path
   * @param {string[]} diffContent - Array of diff content lines
   * @returns {('LOW'|'MEDIUM'|'HIGH')} Risk level
   */
  identifyRiskLevel(file, diffContent) {
    // Always treat markdown files as low risk
    if (/\.(md|mdx|markdown)$/i.test(file)) {
      return 'LOW';
    }

    let riskLevel = 'LOW';
    const diffText = diffContent.join('\n');
    
    // Check file patterns first
    for (const [level, patterns] of Object.entries(this.filePatterns)) {
      if (patterns.some(pattern => pattern.test(file))) {
        riskLevel = level;
        break;
      }
    }

    // Check content patterns
    for (const [level, categories] of Object.entries(this.riskPatterns)) {
      let hasMatch = false;
      
      for (const [category, patterns] of Object.entries(categories)) {
        if (patterns.some(pattern => pattern.test(diffText))) {
          hasMatch = true;
          break;
        }
      }
      
      if (hasMatch) {
        // Upgrade risk level if content risk is higher than file risk
        const riskLevels = ['LOW', 'MEDIUM', 'HIGH'];
        const currentRiskIndex = riskLevels.indexOf(riskLevel);
        const contentRiskIndex = riskLevels.indexOf(level);
        if (contentRiskIndex > currentRiskIndex) {
          riskLevel = level;
        }
        break;
      }
    }

    return riskLevel;
  }

  /**
   * Categorizes file changes from a commit into added, modified, deleted, and renamed
   * @param {Object} commit - Commit object
   * @param {string} commit.hash - Commit hash
   * @returns {Promise<Object>} Categorized changes
   * @throws {GitLogError} If diff stream processing fails
   */
  async categorizeFileChanges(commit) {
    const changes = {
      added: new Map(),
      modified: new Map(),
      deleted: new Map(),
      renamed: new Map()
    };

    return new Promise(async (resolve, reject) => {
      try {
        const diffStream = await getCommitDiff(commit.hash, null, { stream: true });
        let currentFile = null;
        let currentType = null;
        let currentHunk = [];
        let isInDiff = false;
        let diffContent = '';

        diffStream.on('data', (chunk) => {
          const lines = (diffContent + chunk.toString()).split('\n');
          // Keep the last partial line for next chunk if any
          diffContent = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('diff --git')) {
              if (currentFile && currentHunk.length > 0) {
                this.addFileChange(changes, currentType, currentFile, [currentHunk]);
              }
              const [status, newFile] = this.parseFileStatus(line, diffContent);
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
          }
        });

        diffStream.on('end', () => {
          // Process any remaining content
          if (diffContent) {
            const line = diffContent;
            if (line.startsWith('diff --git')) {
              if (currentFile && currentHunk.length > 0) {
                this.addFileChange(changes, currentType, currentFile, [currentHunk]);
              }
              const [status, newFile] = this.parseFileStatus(line, diffContent);
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
          }

          // Add any final changes
          if (currentFile && currentHunk.length > 0) {
            this.addFileChange(changes, currentType, currentFile, [currentHunk]);
          }

          resolve(changes);
        });

        diffStream.on('error', (error) => {
          reject(new GitLogError(
            'Error processing git diff stream: ' + error.message,
            'DIFF_STREAM_ERROR',
            { error: error.message }
          ));
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Adds file changes to the appropriate category
   * @param {Object} changes - Changes object containing maps for each change type
   * @param {string} type - Change type (added, modified, deleted, renamed)
   * @param {string} file - File path
   * @param {string[][]} hunks - Array of diff hunks
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
   * Parses file status from git diff output
   * @param {string} diffLine - Diff header line
   * @param {string} fullDiff - Complete diff content
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
   * Formats diff content for markdown display
   * @param {string[]} diffContent - Array of diff lines
   * @returns {string} Formatted diff content
   * @private
   */
  formatDiffForMarkdown(diffContent) {
    return diffContent.map(line => {
      // Remove the diff marker for processing
      let content = line.startsWith('+') || line.startsWith('-') || line.startsWith(' ') 
        ? line.substring(1) 
        : line;

      // Escape markdown special characters
      content = content
        .replace(/\*/g, '\\*')   // Bold/italic
        .replace(/_/g, '\\_')    // Italic
        .replace(/`/g, '\\`')    // Code
        .replace(/\[/g, '\\[')   // Links
        .replace(/\]/g, '\\]')   // Links
        .replace(/\(/g, '\\(')   // Links
        .replace(/\)/g, '\\)')   // Links
        .replace(/\#/g, '\\#')   // Headers
        .replace(/\|/g, '\\|')   // Tables
        .replace(/\{/g, '\\{')   // Code blocks
        .replace(/\}/g, '\\}')   // Code blocks
        .replace(/\~/g, '\\~')   // Strikethrough
        .replace(/\>/g, '\\>');  // Blockquotes

      // Add back the diff marker
      if (line.startsWith('+')) {
        return '+ ' + content;
      } else if (line.startsWith('-')) {
        return '- ' + content;
      }
      return '  ' + content;
    }).join('\n');
  }

  /**
   * Generates review checklist based on file type and risk level
   * @param {string} file - File path
   * @param {string} type - Change type
   * @param {string} riskLevel - Risk level
   * @returns {string} Generated checklist in markdown format
   * @private
   */
  generateChecklist(file, type, riskLevel) {
    const checks = [
      // Common checks
      '- [ ] Changes are intentional and necessary',
      '- [ ] Code follows project standards',
    ];

    // Risk level specific checks
    if (riskLevel === 'HIGH') {
      checks.push(
        '- [ ] Security implications reviewed',
        '- [ ] Error handling is comprehensive',
        '- [ ] Input validation is thorough',
        '- [ ] Sensitive data is properly handled',
        '- [ ] Proper logging (no sensitive data)',
        '- [ ] Performance impact considered'
      );
    }

    // Type specific checks
    const typeChecks = {
      added: [
        '- [ ] New file is necessary and properly placed',
        '- [ ] Dependencies are properly managed',
        '- [ ] File organization follows project structure'
      ],
      modified: [
        '- [ ] No unintended changes',
        '- [ ] Backwards compatibility maintained',
        '- [ ] Related files updated'
      ],
      deleted: [
        '- [ ] File removal impact is assessed',
        '- [ ] All references removed',
        '- [ ] No breaking changes introduced',
        '- [ ] Clean up related resources'
      ],
      renamed: [
        '- [ ] All references updated',
        '- [ ] Import/export paths corrected',
        '- [ ] Documentation updated'
      ]
    };

    checks.push(...(typeChecks[type] || []));

    // File type specific checks
    if (file.includes('test')) {
      checks.push(
        '- [ ] Test cases are comprehensive',
        '- [ ] Edge cases are covered',
        '- [ ] Assertions are meaningful'
      );
    }
    if (file.endsWith('.json')) {
      checks.push(
        '- [ ] JSON structure is valid',
        '- [ ] Configuration is complete',
        '- [ ] No sensitive data exposed'
      );
    }

    return checks.join('\n');
  }

  /**
   * Writes a section of changes to the review file
   * @param {WriteStream} stream - Output stream
   * @param {string} type - Change type
   * @param {Map<string, string[][]>} files - Map of files and their changes
   * @param {string} typeEmoji - Emoji representing the change type
   * @returns {Promise<void>}
   * @private
   */
  async writeChangesSection(stream, type, files, typeEmoji) {
    if (files.size === 0) return;
    
    stream.write(`### ${typeEmoji} ${type.charAt(0).toUpperCase() + type.slice(1)} Files\n\n`);
    
    for (const [file, hunks] of files) {
      const riskLevel = this.identifyRiskLevel(file, hunks.flat());
      const riskEmoji = {
        HIGH: '🔴',
        MEDIUM: '🟡',
        LOW: '🟢'
      }[riskLevel];

      stream.write(`#### ${file} ${riskEmoji}\n`);
      stream.write('**Review Checklist**\n');
      stream.write(this.generateChecklist(file, type, riskLevel) + '\n\n');

      stream.write('```diff\n');
      hunks.forEach(hunk => {
        stream.write(this.formatDiffForMarkdown(hunk) + '\n');
      });
      stream.write('```\n\n');
    }
  }

  /**
   * Writes detailed review content for each commit
   * @param {WriteStream} stream - Output stream
   * @param {Object[]} commits - Array of commit objects
   * @returns {Promise<void>}
   * @private
   */
  async writeReviewContent(stream, commits) {
    for (const commit of commits) {
      stream.write(`\n## Commit: ${commit.subject}\n`);
      stream.write(`Hash: \`${commit.hash}\`\n`);
      stream.write(`Date: ${new Date(commit.date).toLocaleString()}\n\n`);

      if (commit.body) {
        stream.write('### Description\n');
        stream.write(commit.body + '\n\n');
      }

      const changes = await this.categorizeFileChanges(commit);
      
      await this.writeChangesSection(stream, 'added', changes.added, '➕');
      await this.writeChangesSection(stream, 'modified', changes.modified, '📝');
      await this.writeChangesSection(stream, 'deleted', changes.deleted, '🗑️');
      await this.writeChangesSection(stream, 'renamed', changes.renamed, '📋');

      stream.write('---\n');
    }
  }

  /**
   * Executes the review command
   * @returns {Promise<Object>} Object containing the review file path
   * @throws {GitLogError} If execution fails
   */
  async execute() {
    let originalBranch = null;
    let reviewBranch = null;

    try {
      if (!await isGitRepository()) {
        throw new GitLogError(
          'Not a git repository. Please run this command from within a git repository.',
          'NOT_GIT_REPO'
        );
      }

      console.log(`${colors.blue}Preparing review for ${colors.bright}${this.author}${colors.reset}`);
      console.log(`${colors.blue}Time range: ${this.since} to ${this.until}${colors.reset}\n`);

      const commits = await getAuthorCommits(this.author, this.since, this.until);
      
      if (!commits.length) {
        console.log(`${colors.yellow}No commits found in the specified time range${colors.reset}`);
        return;
      }

      if (this.createBranch) {
        // Store current branch for cleanup
        originalBranch = await getCurrentBranch();
        
        // Generate review branch name if not provided
        reviewBranch = this.branchName || `review/${this.author}/${new Date().toISOString().replace(/[:.]/g, '-')}`;
        
        console.log(`${colors.blue}Creating review branch: ${colors.bright}${reviewBranch}${colors.reset}`);
        
        // Create review branch from base commit or first commit's parent
        const startPoint = this.baseCommit || `${commits[0].hash}^`;
        await createReviewBranch(reviewBranch, commits.map(c => c.hash), startPoint);
        
        // Get diff from base
        const diffStream = await getBranchDiff(startPoint, reviewBranch, { stream: true });
        const changes = await this.categorizeFileChanges(diffStream);
        
        const reviewFile = this.writer.generateFilename(this.author, 'review');
        const reviewStream = this.writer.createStream(reviewFile);

        this.writer.writeHeader(reviewStream, `Code Review Report for ${this.author}`, {
          until: this.until,
          branch: reviewBranch,
          base: startPoint
        });

        // Write overview
        reviewStream.write('# Summary\n\n');
        reviewStream.write(`- Total Commits: ${commits.length}\n`);
        reviewStream.write(`- Review Date: ${new Date().toLocaleString()}\n`);
        reviewStream.write(`- Review Branch: ${reviewBranch}\n`);
        reviewStream.write(`- Base: ${startPoint}\n`);
    
    // Categorize all changes for summary
    const totalChanges = {
      added: 0,
      modified: 0,
      deleted: 0,
      renamed: 0,
      riskLevels: { HIGH: 0, MEDIUM: 0, LOW: 0 }
    };

    for (const commit of commits) {
      const changes = await this.categorizeFileChanges(commit);
      totalChanges.added += changes.added.size;
      totalChanges.modified += changes.modified.size;
      totalChanges.deleted += changes.deleted.size;
      totalChanges.renamed += changes.renamed.size;

      // Count risk levels
      for (const [type, files] of Object.entries(changes)) {
        for (const [file, hunks] of files) {
          const riskLevel = this.identifyRiskLevel(file, hunks.flat());
          totalChanges.riskLevels[riskLevel]++;
        }
      }
    }

    // Write change statistics
    reviewStream.write('\n## Change Statistics\n\n');
    reviewStream.write('### File Changes\n');
    reviewStream.write(`- ➕ Added: ${totalChanges.added}\n`);
    reviewStream.write(`- 📝 Modified: ${totalChanges.modified}\n`);
    reviewStream.write(`- 🗑️ Deleted: ${totalChanges.deleted}\n`);
    reviewStream.write(`- 📋 Renamed: ${totalChanges.renamed}\n`);

    reviewStream.write('\n### Risk Distribution\n');
    reviewStream.write(`- 🔴 High Risk: ${totalChanges.riskLevels.HIGH}\n`);
    reviewStream.write(`- 🟡 Medium Risk: ${totalChanges.riskLevels.MEDIUM}\n`);
    reviewStream.write(`- 🟢 Low Risk: ${totalChanges.riskLevels.LOW}\n`);

    // Add quick navigation for high-risk changes if any exist
    if (totalChanges.riskLevels.HIGH > 0) {
      reviewStream.write('\n## ⚠️ High Risk Changes Quick Access\n\n');
      for (const commit of commits) {
        const changes = await this.categorizeFileChanges(commit);
        for (const [type, files] of Object.entries(changes)) {
          for (const [file, hunks] of files) {
            const riskLevel = this.identifyRiskLevel(file, hunks.flat());
            if (riskLevel === 'HIGH') {
              reviewStream.write(`- ${file} (${type}) in commit ${commit.hash.slice(0, 7)}\n`);
            }
          }
        }
      }
    }

    reviewStream.write('\n## Review Guidelines\n\n');
    reviewStream.write('### Risk Levels\n');
    reviewStream.write('- 🔴 **HIGH**: Security, data, or infrastructure critical changes\n');
    reviewStream.write('- 🟡 **MEDIUM**: Business logic or significant feature changes\n');
    reviewStream.write('- 🟢 **LOW**: Documentation, styling, or minor changes\n\n');

    reviewStream.write('### Review Priorities\n');
    reviewStream.write('1. Security and data safety\n');
    reviewStream.write('2. Functionality and business logic\n');
    reviewStream.write('3. Code quality and maintainability\n');
    reviewStream.write('4. Performance and scalability\n');
    reviewStream.write('5. Documentation and comments\n\n');

    // Write detailed review content with categorized diffs
    reviewStream.write('---\n\n');
    reviewStream.write('# Detailed Changes\n\n');
    await this.writeReviewContent(reviewStream, commits);

    // Write final checklist
    reviewStream.write('\n## Final Review Checklist\n\n');
    
    // Security & Authorization
    reviewStream.write('### 🔐 Security & Authorization\n');
    reviewStream.write('- [ ] Authentication checks are properly implemented\n');
    reviewStream.write('- [ ] Authorization rules are correctly applied\n');
    reviewStream.write('- [ ] No security vulnerabilities introduced\n');
    reviewStream.write('- [ ] Sensitive data is properly handled\n');
    reviewStream.write('- [ ] Input validation is thorough\n');
    reviewStream.write('- [ ] Security best practices followed\n\n');

    // Code Quality
    reviewStream.write('### 📊 Code Quality\n');
    reviewStream.write('- [ ] Code follows project standards\n');
    reviewStream.write('- [ ] No unnecessary complexity\n');
    reviewStream.write('- [ ] Error handling is comprehensive\n');
    reviewStream.write('- [ ] Logging is appropriate\n');
    reviewStream.write('- [ ] No debug code committed\n');
    reviewStream.write('- [ ] Code is maintainable\n\n');

    // Testing
    reviewStream.write('### 🧪 Testing\n');
    reviewStream.write('- [ ] All changes are tested\n');
    reviewStream.write('- [ ] Test coverage is adequate\n');
    reviewStream.write('- [ ] Edge cases are covered\n');
    reviewStream.write('- [ ] Error scenarios tested\n');
    reviewStream.write('- [ ] Performance testing done (if applicable)\n\n');

    // Documentation
    reviewStream.write('### 📚 Documentation\n');
    reviewStream.write('- [ ] Code is self-documenting\n');
    reviewStream.write('- [ ] Comments are clear and necessary\n');
    reviewStream.write('- [ ] API documentation updated\n');
    reviewStream.write('- [ ] README updated if needed\n');
    reviewStream.write('- [ ] Change log updated\n\n');

    // Performance
    reviewStream.write('### ⚡ Performance\n');
    reviewStream.write('- [ ] No performance regressions\n');
    reviewStream.write('- [ ] Resource usage is optimized\n');
    reviewStream.write('- [ ] Database queries are efficient\n');
    reviewStream.write('- [ ] Caching strategy is appropriate\n');
    reviewStream.write('- [ ] Network calls are optimized\n\n');

    // Dependencies
    reviewStream.write('### 📦 Dependencies\n');
    reviewStream.write('- [ ] No unnecessary dependencies added\n');
    reviewStream.write('- [ ] Dependencies are up to date\n');
    reviewStream.write('- [ ] No conflicting dependencies\n');
    reviewStream.write('- [ ] Security vulnerabilities checked\n\n');

    // Review Notes
    reviewStream.write('### 📝 Review Notes\n');
    reviewStream.write('Add any additional notes, concerns, or follow-up items here:\n\n');
    reviewStream.write('```\n\n```\n');

        await this.writer.closeStream(reviewStream);
        this.writer.logSuccess('review', reviewFile);

        if (this.cleanup) {
          console.log(`${colors.blue}Cleaning up review branch${colors.reset}`);
          await cleanupReviewBranch(reviewBranch, originalBranch);
        } else {
          console.log(`${colors.blue}Review branch ${colors.bright}${reviewBranch}${colors.reset}${colors.blue} preserved${colors.reset}`);
        }

        return { reviewFile, reviewBranch };
      } else {
        // Original non-branch behavior
        const reviewFile = this.writer.generateFilename(this.author, 'review');
        const reviewStream = this.writer.createStream(reviewFile);

        this.writer.writeHeader(reviewStream, `Code Review Report for ${this.author}`, {
          until: this.until
        });

        // Write overview
        reviewStream.write('# Summary\n\n');
        reviewStream.write(`- Total Commits: ${commits.length}\n`);
        reviewStream.write(`- Review Date: ${new Date().toLocaleString()}\n`);

        await this.writer.closeStream(reviewStream);
        this.writer.logSuccess('review', reviewFile);

        return { reviewFile };
      }
    } catch (error) {
      // Cleanup on error if needed
      if (this.cleanup && reviewBranch && originalBranch) {
        try {
          await cleanupReviewBranch(reviewBranch, originalBranch);
        } catch (cleanupError) {
          console.error(`${colors.yellow}Warning: Failed to cleanup review branch: ${cleanupError.message}${colors.reset}`);
        }
      }

      if (error instanceof GitLogError) {
        throw error;
      }
      throw new GitLogError(
        'Error generating review: ' + error.message,
        'REVIEW_GENERATION_FAILED',
        { error: error.message }
      );
    }
}
}

module.exports = ReviewCommand;
