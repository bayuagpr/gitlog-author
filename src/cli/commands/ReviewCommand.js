// src/cli/commands/ReviewCommand.js

const CommandHandler = require('./CommandHandler');
const ReportWriter = require('../writers/ReportWriter');
const { colors } = require('../../constants');
const { isGitRepository } = require('../../services/gitOperations');
const { getAuthorCommits } = require('../../services/authorService');
const GitLogError = require('../../models/GitLogError');
const RiskAssessmentService = require('../../services/RiskAssessmentService');
const GitChangeService = require('../../services/GitChangeService');
const ReviewReportGenerator = require('../../services/ReviewReportGenerator');

/**
 * Handles the review command to generate git commit review reports for a specific author
 * @extends CommandHandler
 */
class ReviewCommand extends CommandHandler {
  /**
   * Creates a new ReviewCommand instance
   * @param {string[]} args - Command line arguments
   * @param {string} args[0] - Author name or email
   * @param {Object} [args.since='1 day ago'] - Start date for commit range
   * @param {Object} [args.until='now'] - End date for commit range
   * @param {number} [args.context=5] - Number of lines of context to show in diffs
   */
  constructor(args) {
    super(args);
    this.author = args[0];
    this.since = this.getArg('since', '1 day ago');
    this.until = this.getArg('until', 'now');
    this.maxDiffContext = parseInt(this.getArg('context', '5'), 10);
    this.useStream = this.getArg('stream', 'auto'); // 'auto', 'true', or 'false'
    
    // Initialize services
    this.writer = new ReportWriter();
    this.riskService = new RiskAssessmentService();
    this.gitService = new GitChangeService();
    this.reportGenerator = new ReviewReportGenerator(this.writer, this.riskService);
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
   * Executes the review command to generate a detailed report of an author's commits
   * @async
   * @returns {Promise<Object>} Generated review report containing commit analysis, risk assessment, and code changes
   * @throws {GitLogError} If not in a git repository
   * @throws {GitLogError} If author has no commits in the specified time range
   * @throws {GitLogError} If there's an error processing commits or generating the review
   */
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

      // Determine if we should use streaming based on conditions
      const shouldUseStream = await this.shouldUseStreaming(commits);
      
      // Process all commits in batches for better performance
      const changesMap = await this.gitService.batchProcessCommits(commits, { stream: shouldUseStream });
      
      // Generate the report using the report generator
      const result = await this.reportGenerator.generateReport(this.author, commits, changesMap);

      // Clean up the git service cache
      this.gitService.clearCache();

      return result;
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

  /**
   * Determines if streaming should be used based on conditions and user preference
   * @param {Array<Object>} commits - Array of commits to process
   * @returns {Promise<boolean>} Whether to use streaming
   * @private
   */
  async shouldUseStreaming(commits) {
    // If explicitly set, respect user preference
    if (this.useStream === 'true') return true;
    if (this.useStream === 'false') return false;

    // In auto mode, analyze conditions
    try {
      // Sample the first commit to check diff size
      if (commits.length > 0) {
        const sampleDiff = await this.gitService.getCommitDiff(commits[0].hash);
        const diffSizeInMB = Buffer.byteLength(sampleDiff, 'utf8') / (1024 * 1024);
        
        // Use streaming if:
        // 1. Single diff is larger than 50MB
        if (diffSizeInMB > 50) return true;
        
        // 2. Total estimated size is larger than 200MB
        const estimatedTotalSize = diffSizeInMB * commits.length;
        if (estimatedTotalSize > 200) return true;
      }
    } catch (error) {
      // If we can't determine size, default to non-streaming
      console.log(`${colors.yellow}Warning: Could not determine diff size, defaulting to non-streaming mode${colors.reset}`);
    }

    return false;
  }
}

module.exports = ReviewCommand;
