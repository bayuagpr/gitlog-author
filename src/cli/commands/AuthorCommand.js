const CommandHandler = require('./CommandHandler');
const ReportWriter = require('../writers/ReportWriter');
const { colors } = require('../../constants');
const { isGitRepository } = require('../../services/gitOperations');
const { getAuthorCommits, getCommitDetails } = require('../../services/authorService');
const { calculateVelocityMetrics } = require('../../services/metricsService');
const GitLogError = require('../../models/GitLogError');

/**
 * @class AuthorCommand
 * @description Handles generation of author commit logs and metrics
 */
class AuthorCommand extends CommandHandler {
  /**
   * @param {string[]} args - Command line arguments
   */
  constructor(args) {
    super(args);
    this.author = args[0];
    this.since = this.getArg('since');
    this.until = this.getArg('until');
    this.includeDirs = this.getDirList('include-dirs');
    this.excludeDirs = this.getDirList('exclude-dirs');
    this.skipMetrics = this.hasFlag('no-metrics');
    this.writer = new ReportWriter();
  }

  /**
   * Validate command arguments
   * @throws {GitLogError} If validation fails
   */
  validateArgs() {
    if (!this.author) {
      throw new GitLogError('Author name or email is required', 'INVALID_AUTHOR');
    }

    if (this.includeDirs.length > 0 && this.excludeDirs.length > 0) {
      throw new GitLogError(
        'Cannot use both --include-dirs and --exclude-dirs at the same time',
        'INVALID_ARGS'
      );
    }
  }

  /**
   * Write commit details to the report
   * @param {WriteStream} stream - Output stream
   * @param {Object} commit - Commit data
   */
  async writeCommitDetails(stream, commit) {
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

    const details = await getCommitDetails(commit.hash);
    if (details.trim()) {
      commitContent.push('**Changes:**\n```\n');
      commitContent.push(details.trim());
      commitContent.push('\n```\n\n');
    }

    commitContent.push('---\n\n');
    stream.write(commitContent.join(''));
  }

  /**
   * Write metrics report
   * @param {Object} metrics - Metrics data
   * @returns {Promise<string>} Path to metrics file
   */
  async writeMetricsReport(metrics) {
    const metricsFile = this.writer.generateFilename(this.author, 'metrics');
    const metricsStream = this.writer.createStream(metricsFile);
    
    this.writer.writeHeader(metricsStream, `Productivity Metrics for ${this.author}`, {
      since: this.since,
      until: this.until,
      includeDirs: this.includeDirs,
      excludeDirs: this.excludeDirs
    });
    
    metricsStream.write('## Code Velocity\n\n');
    metricsStream.write(`- **Total Lines Changed:** ${metrics.totalLinesChanged.toLocaleString()}\n`);
    metricsStream.write(`- **Average Changes per Commit:** ${metrics.averageCommitSize.toLocaleString()} lines\n`);
    metricsStream.write(`- **Commit Frequency:** ${metrics.commitsPerDay} commits per day\n`);
    metricsStream.write('\n**Time Distribution:**\n');
    metricsStream.write(`- Morning (5:00-11:59): ${metrics.timeDistribution.morning}%\n`);
    metricsStream.write(`- Afternoon (12:00-16:59): ${metrics.timeDistribution.afternoon}%\n`);
    metricsStream.write(`- Evening (17:00-4:59): ${metrics.timeDistribution.evening}%\n`);
    
    metricsStream.write('\n## Impact Analysis\n\n');
    metricsStream.write('**Most Modified Source Files:**\n');
    if (metrics.impactMetrics.topFiles.length > 0) {
      metrics.impactMetrics.topFiles.forEach(({ file, changes }) => {
        metricsStream.write(`- \`${file}\`: ${changes.toLocaleString()} changes\n`);
      });
    } else {
      metricsStream.write('No source code changes found\n');
    }
    
    metricsStream.write('\n**Directory Impact:**\n');
    if (metrics.impactMetrics.groupedDirectories && metrics.impactMetrics.groupedDirectories.size > 0) {
      metricsStream.write('```\n');
      metricsStream.write(JSON.stringify(metrics.impactMetrics.directoryImpact, null, 2));
      metricsStream.write('\n```\n');
    } else {
      metricsStream.write('No directory impact data available\n');
    }


    metricsStream.write('\n## Commit Type Analysis\n\n');
    metricsStream.write(`**Primary Contribution Type:** ${metrics.typeMetrics.primaryContributionType}\n\n`);
    metricsStream.write('**Type Breakdown:**\n');
    metrics.typeMetrics.typeBreakdown.forEach(({ type, percentage }) => {
      metricsStream.write(`- ${type}: ${percentage}%\n`);
    });
    
    await this.writer.closeStream(metricsStream);
    this.writer.logSuccess('metrics', metricsFile);
    
    return metricsFile;
  }

  /**
   * Execute the author command
   */
  async execute() {
    try {
      if (!await isGitRepository()) {
        throw new GitLogError(
          'Not a git repository. Please run this command from within a git repository.',
          'NOT_GIT_REPO'
        );
      }

      console.log(`${colors.blue}Fetching commits for author: ${colors.bright}${this.author}${colors.reset}`);
      
      const commits = await getAuthorCommits(
        this.author,
        this.since,
        this.until,
        this.includeDirs,
        this.excludeDirs
      );

      console.log(`${colors.green}✓ Found ${colors.bright}${commits.length}${colors.reset}${colors.green} commits${colors.reset}`);
      
      if (!commits.length) {
        console.log(`${colors.yellow}No commits found for author: ${this.author}${colors.reset}`);
        return;
      }

      const commitsFile = this.writer.generateFilename(this.author, 'commits');
      const commitsStream = this.writer.createStream(commitsFile);

      this.writer.writeHeader(commitsStream, `Git Log for ${this.author}`, {
        since: this.since,
        until: this.until,
        includeDirs: this.includeDirs,
        excludeDirs: this.excludeDirs
      });

      let metricsFile;
      if (!this.skipMetrics) {
        console.log(`${colors.blue}Calculating productivity metrics...${colors.reset}`);
        const metrics = await calculateVelocityMetrics(commits, this.includeDirs, this.excludeDirs);
        metricsFile = await this.writeMetricsReport(metrics);
      }

      commitsStream.write('## Commits\n\n');
      console.log(`${colors.blue}Processing commits and generating log file...${colors.reset}`);
      
      // Process commits in chunks while maintaining order
      const chunkSize = 15;
      for (let i = 0; i < commits.length; i += chunkSize) {
        const chunk = commits.slice(i, Math.min(i + chunkSize, commits.length));
        const progress = Math.min(((i + chunk.length) / commits.length) * 100, 100).toFixed(0);
        process.stdout.write(`${colors.dim}Progress: ${progress}%${colors.reset}\r`);
        
        // Process chunk in parallel but write sequentially
        const chunkPromises = chunk.map(commit => this.writeCommitDetails(commitsStream, commit));
        await Promise.all(chunkPromises);
      }

      await this.writer.closeStream(commitsStream);
      process.stdout.write('\n');
      this.writer.logSuccess('commits', commitsFile);
      
      return { commitsFile, metricsFile };
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
}

module.exports = AuthorCommand;
