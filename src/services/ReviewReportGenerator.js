const { colors } = require('../constants');

/**
 * @class ReviewReportGenerator
 * @description Generates detailed code review reports in markdown format with risk assessments and change analysis
 */
class ReviewReportGenerator {
  /**
   * @constructor
   * @param {Object} writer - File writer service for creating and managing report files
   * @param {Object} riskAssessmentService - Service for assessing code risk levels and generating checklists
   */
  constructor(writer, riskAssessmentService) {
    this.writer = writer;
    this.riskAssessmentService = riskAssessmentService;
  }

  /**
   * @param {string[]} diffContent - Array of diff lines to format
   * @returns {string} Markdown-escaped diff content
   * @description Formats git diff content for markdown by escaping special characters while preserving diff markers
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
   * @param {WriteStream} stream - Output stream for writing
   * @param {string} type - Type of changes (added/modified/deleted/renamed)
   * @param {Map<string, string[][]>} files - Map of filenames to their diff hunks
   * @param {string} typeEmoji - Emoji representing the change type
   * @returns {Promise<void>}
   * @description Writes a section of changes for a specific type with risk assessments and checklists
   */
  async writeChangesSection(stream, type, files, typeEmoji) {
    if (files.size === 0) return;
    
    stream.write(`### ${typeEmoji} ${type.charAt(0).toUpperCase() + type.slice(1)} Files\n\n`);
    
    for (const [file, hunks] of files) {
      const riskLevel = this.riskAssessmentService.identifyRiskLevel(file, hunks.flat());
      const riskEmoji = {
        HIGH: '🔴',
        MEDIUM: '🟡',
        LOW: '🟢'
      }[riskLevel];

      stream.write(`#### ${file} ${riskEmoji}\n`);
      stream.write('**Review Checklist**\n');
      stream.write(this.riskAssessmentService.generateChecklist(file, type, riskLevel) + '\n\n');

      stream.write('```diff\n');
      hunks.forEach(hunk => {
        stream.write(this.formatDiffForMarkdown(hunk) + '\n');
      });
      stream.write('```\n\n');
    }
  }

  /**
   * @param {WriteStream} stream - Output stream for writing
   * @param {Object[]} commits - Array of commit objects
   * @param {Map<string, Object>} changesMap - Map of commit hashes to their changes
   * @returns {Promise<void>}
   * @description Writes detailed review content for each commit including diffs and risk assessments
   */
  async writeReviewContent(stream, commits, changesMap) {
    for (const commit of commits) {
      stream.write(`\n## Commit: ${commit.subject}\n`);
      stream.write(`Hash: \`${commit.hash}\`\n`);
      stream.write(`Date: ${new Date(commit.date).toLocaleString()}\n\n`);

      if (commit.body) {
        stream.write('### Description\n');
        stream.write(commit.body + '\n\n');
      }

      const changes = changesMap.get(commit.hash);
      
      await this.writeChangesSection(stream, 'added', changes.added, '➕');
      await this.writeChangesSection(stream, 'modified', changes.modified, '📝');
      await this.writeChangesSection(stream, 'deleted', changes.deleted, '🗑️');
      await this.writeChangesSection(stream, 'renamed', changes.renamed, '📋');

      stream.write('---\n');
    }
  }

  /**
   * @param {string} author - Author name
   * @param {Object[]} commits - Array of commit objects
   * @param {Map<string, Object>} changesMap - Map of commit hashes to their changes
   * @returns {Promise<Object>} Object containing the generated review file path
   * @description Generates a complete code review report with summary, statistics, and detailed changes
   */
  async generateReport(author, commits, changesMap) {
    console.log(`${colors.blue}Generating review report for ${colors.bright}${author}${colors.reset}`);
    
    const reviewFile = this.writer.generateFilename(author, 'review');
    const reviewStream = this.writer.createStream(reviewFile);

    this.writer.writeHeader(reviewStream, `Code Review Report for ${author}`);

    // Write overview
    reviewStream.write('# Summary\n\n');
    reviewStream.write(`- Total Commits: ${commits.length}\n`);
    reviewStream.write(`- Review Date: ${new Date().toLocaleString()}\n`);
    
    // Categorize all changes for summary
    const totalChanges = this.calculateTotalChanges(commits, changesMap);

    // Write change statistics
    this.writeChangeStatistics(reviewStream, totalChanges);
    
    // Add quick navigation for high-risk changes
    await this.writeHighRiskNavigation(reviewStream, commits, changesMap);

    // Write review guidelines
    this.writeReviewGuidelines(reviewStream);

    // Write detailed review content
    reviewStream.write('---\n\n');
    reviewStream.write('# Detailed Changes\n\n');
    await this.writeReviewContent(reviewStream, commits, changesMap);

    // Write final checklist
    this.writeFinalChecklist(reviewStream);

    await this.writer.closeStream(reviewStream);
    this.writer.logSuccess('review', reviewFile);

    return { reviewFile };
  }

  /**
   * @param {Object[]} commits - Array of commit objects
   * @param {Map<string, Object>} changesMap - Map of commit hashes to their changes
   * @returns {Object} Statistics of total changes and risk levels
   * @description Calculates total changes and risk level distribution across all commits
   */
  calculateTotalChanges(commits, changesMap) {
    const totalChanges = {
      added: 0,
      modified: 0,
      deleted: 0,
      renamed: 0,
      riskLevels: { HIGH: 0, MEDIUM: 0, LOW: 0 }
    };

    for (const commit of commits) {
      const changes = changesMap.get(commit.hash);
      totalChanges.added += changes.added.size;
      totalChanges.modified += changes.modified.size;
      totalChanges.deleted += changes.deleted.size;
      totalChanges.renamed += changes.renamed.size;

      // Count risk levels
      for (const [type, files] of Object.entries(changes)) {
        for (const [file, hunks] of files) {
          const riskLevel = this.riskAssessmentService.identifyRiskLevel(file, hunks.flat());
          totalChanges.riskLevels[riskLevel]++;
        }
      }
    }

    return totalChanges;
  }

  /**
   * @param {WriteStream} stream - Output stream for writing
   * @param {Object} totalChanges - Object containing change statistics
   * @description Writes change statistics including file changes and risk distribution
   */
  writeChangeStatistics(stream, totalChanges) {
    stream.write('\n## Change Statistics\n\n');
    stream.write('### File Changes\n');
    stream.write(`- ➕ Added: ${totalChanges.added}\n`);
    stream.write(`- 📝 Modified: ${totalChanges.modified}\n`);
    stream.write(`- 🗑️ Deleted: ${totalChanges.deleted}\n`);
    stream.write(`- 📋 Renamed: ${totalChanges.renamed}\n`);

    stream.write('\n### Risk Distribution\n');
    stream.write(`- 🔴 High Risk: ${totalChanges.riskLevels.HIGH}\n`);
    stream.write(`- 🟡 Medium Risk: ${totalChanges.riskLevels.MEDIUM}\n`);
    stream.write(`- 🟢 Low Risk: ${totalChanges.riskLevels.LOW}\n`);
  }

  /**
   * @param {WriteStream} stream - Output stream for writing
   * @param {Object[]} commits - Array of commit objects
   * @param {Map<string, Object>} changesMap - Map of commit hashes to their changes
   * @returns {Promise<void>}
   * @description Creates quick navigation links for high-risk changes
   */
  async writeHighRiskNavigation(stream, commits, changesMap) {
    let hasHighRisk = false;
    for (const commit of commits) {
      const changes = changesMap.get(commit.hash);
      for (const [type, files] of Object.entries(changes)) {
        for (const [file, hunks] of files) {
          if (this.riskAssessmentService.identifyRiskLevel(file, hunks.flat()) === 'HIGH') {
            if (!hasHighRisk) {
              stream.write('\n## ⚠️ High Risk Changes Quick Access\n\n');
              hasHighRisk = true;
            }
            stream.write(`- ${file} (${type}) in commit ${commit.hash.slice(0, 7)}\n`);
          }
        }
      }
    }
  }

  /**
   * @param {WriteStream} stream - Output stream for writing
   * @description Writes review guidelines including risk levels and review priorities
   */
  writeReviewGuidelines(stream) {
    stream.write('\n## Review Guidelines\n\n');
    stream.write('### Risk Levels\n');
    stream.write('- 🔴 **HIGH**: Security, data, or infrastructure critical changes\n');
    stream.write('- 🟡 **MEDIUM**: Business logic or significant feature changes\n');
    stream.write('- 🟢 **LOW**: Documentation, styling, or minor changes\n\n');

    stream.write('### Review Priorities\n');
    stream.write('1. Security and data safety\n');
    stream.write('2. Functionality and business logic\n');
    stream.write('3. Code quality and maintainability\n');
    stream.write('4. Performance and scalability\n');
    stream.write('5. Documentation and comments\n\n');
  }

  /**
   * @param {WriteStream} stream - Output stream for writing
   * @description Writes comprehensive final review checklist covering security, code quality, testing, etc.
   */
  writeFinalChecklist(stream) {
    stream.write('\n## Final Review Checklist\n\n');
    
    // Security & Authorization
    stream.write('### 🔐 Security & Authorization\n');
    stream.write('- [ ] Authentication checks are properly implemented\n');
    stream.write('- [ ] Authorization rules are correctly applied\n');
    stream.write('- [ ] No security vulnerabilities introduced\n');
    stream.write('- [ ] Sensitive data is properly handled\n');
    stream.write('- [ ] Input validation is thorough\n');
    stream.write('- [ ] Security best practices followed\n\n');

    // Code Quality
    stream.write('### 📊 Code Quality\n');
    stream.write('- [ ] Code follows project standards\n');
    stream.write('- [ ] No unnecessary complexity\n');
    stream.write('- [ ] Error handling is comprehensive\n');
    stream.write('- [ ] Logging is appropriate\n');
    stream.write('- [ ] No debug code committed\n');
    stream.write('- [ ] Code is maintainable\n\n');

    // Testing
    stream.write('### 🧪 Testing\n');
    stream.write('- [ ] All changes are tested\n');
    stream.write('- [ ] Test coverage is adequate\n');
    stream.write('- [ ] Edge cases are covered\n');
    stream.write('- [ ] Error scenarios tested\n');
    stream.write('- [ ] Performance testing done (if applicable)\n\n');

    // Documentation
    stream.write('### 📚 Documentation\n');
    stream.write('- [ ] Code is self-documenting\n');
    stream.write('- [ ] Comments are clear and necessary\n');
    stream.write('- [ ] API documentation updated\n');
    stream.write('- [ ] README updated if needed\n');
    stream.write('- [ ] Change log updated\n\n');

    // Performance
    stream.write('### ⚡ Performance\n');
    stream.write('- [ ] No performance regressions\n');
    stream.write('- [ ] Resource usage is optimized\n');
    stream.write('- [ ] Database queries are efficient\n');
    stream.write('- [ ] Caching strategy is appropriate\n');
    stream.write('- [ ] Network calls are optimized\n\n');

    // Dependencies
    stream.write('### 📦 Dependencies\n');
    stream.write('- [ ] No unnecessary dependencies added\n');
    stream.write('- [ ] Dependencies are up to date\n');
    stream.write('- [ ] No conflicting dependencies\n');
    stream.write('- [ ] Security vulnerabilities checked\n\n');

    // Review Notes
    stream.write('### 📝 Review Notes\n');
    stream.write('Add any additional notes, concerns, or follow-up items here:\n\n');
    stream.write('```\n\n```\n');
  }
}

module.exports = ReviewReportGenerator;
