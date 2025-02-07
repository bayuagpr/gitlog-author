// src/cli/commands/ReviewCommand.js

const CommandHandler = require('./CommandHandler');
const ReportWriter = require('../writers/ReportWriter');
const { colors, RISK_PATTERNS, FILE_PATTERNS } = require('../../constants');
const { isGitRepository, getCommitDiff } = require('../../services/gitOperations');
const { getAuthorCommits } = require('../../services/authorService');
const GitLogError = require('../../models/GitLogError');

class ReviewCommand extends CommandHandler {
  constructor(args) {
    super(args);
    this.author = args[0];
    this.since = this.getArg('since', '1 day ago');
    this.until = this.getArg('until', 'now');
    this.maxDiffContext = parseInt(this.getArg('context', '5'), 10);
    this.writer = new ReportWriter();
    
    // Initialize risk patterns
    this.riskPatterns = RISK_PATTERNS;

    // File patterns for risk assessment
    this.filePatterns = FILE_PATTERNS
  }

  validateArgs() {
    if (!this.author) {
      throw new GitLogError('Author name or email is required', 'INVALID_AUTHOR');
    }
  }

  identifyRiskLevel(file, diffContent) {
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

  async categorizeFileChanges(commit) {
    const changes = {
      added: new Map(),
      modified: new Map(),
      deleted: new Map(),
      renamed: new Map()
    };

    const diff = await getCommitDiff(commit.hash);
    let currentFile = null;
    let currentType = null;
    let currentHunk = [];
    let isInDiff = false;

    diff.split('\n').forEach(line => {
      if (line.startsWith('diff --git')) {
        if (currentFile && currentHunk.length > 0) {
          this.addFileChange(changes, currentType, currentFile, [currentHunk]);
        }
        const [status, newFile] = this.parseFileStatus(line, diff);
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
    });

    if (currentFile && currentHunk.length > 0) {
      this.addFileChange(changes, currentType, currentFile, [currentHunk]);
    }

    return changes;
  }

  addFileChange(changes, type, file, hunks) {
    if (!changes[type].has(file)) {
      changes[type].set(file, hunks);
    } else {
      changes[type].get(file).push(...hunks);
    }
  }

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

  async execute() {
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

      const reviewFile = this.writer.generateFilename(this.author, 'review');
      const reviewStream = this.writer.createStream(reviewFile);

      this.writer.writeHeader(reviewStream, `Code Review Report for ${this.author}`, {
        until: this.until
      });

      // Write overview
      reviewStream.write('# Summary\n\n');
      reviewStream.write(`- Total Commits: ${commits.length}\n`);
      reviewStream.write(`- Review Date: ${new Date().toLocaleString()}\n`);
      
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

      return { reviewFile };
    } catch (error) {
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