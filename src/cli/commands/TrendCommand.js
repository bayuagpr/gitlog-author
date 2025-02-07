const CommandHandler = require('./CommandHandler');
const ReportWriter = require('../writers/ReportWriter');
const { colors } = require('../../constants');
const { isGitRepository } = require('../../services/gitOperations');
const { getRollingTrends } = require('../../services/trendService');
const GitLogError = require('../../models/GitLogError');

/**
 * @class TrendCommand
 * @description Handles generation of trend reports
 */
class TrendCommand extends CommandHandler {
  /**
   * @param {string[]} args - Command line arguments
   */
  constructor(args) {
    super(args);
    this.author = args[0];
    this.period = this.getArg('trend');
    this.since = this.getArg('since');
    this.until = this.getArg('until');
    this.includeDirs = this.getDirList('include-dirs');
    this.excludeDirs = this.getDirList('exclude-dirs');
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

    if (!['daily', 'weekly', 'monthly'].includes(this.period)) {
      throw new GitLogError(
        'Invalid trend period. Must be one of: daily, weekly, monthly',
        'INVALID_TREND_PERIOD'
      );
    }

    if (this.includeDirs.length > 0 && this.excludeDirs.length > 0) {
      throw new GitLogError(
        'Cannot use both --include-dirs and --exclude-dirs at the same time',
        'INVALID_ARGS'
      );
    }
  }

  /**
   * Calculate date range based on period
   * @returns {{ startDate: Date, endDate: Date, periodCount: number }}
   */
  calculateDateRange() {
    const endDate = this.until ? new Date(this.until) : new Date();
    let startDate;
    
    if (this.since) {
      startDate = new Date(this.since);
    } else {
      startDate = new Date(endDate);
      switch (this.period) {
        case 'daily':
          startDate.setDate(startDate.getDate() - 6); // Last 7 days
          break;
        case 'weekly':
          startDate.setDate(startDate.getDate() - (4 * 7) + 1); // Last 4 weeks
          break;
        case 'monthly':
          startDate.setMonth(startDate.getMonth() - 5); // Last 6 months
          break;
      }
    }

    if (startDate > endDate) {
      throw new GitLogError(
        'Invalid date range: start date must be before end date',
        'INVALID_DATE_RANGE'
      );
    }

    const msPerDay = 1000 * 60 * 60 * 24;
    const daysDiff = Math.ceil((endDate - startDate) / msPerDay);
    
    let periodCount;
    switch (this.period) {
      case 'daily':
        periodCount = daysDiff;
        break;
      case 'weekly':
        periodCount = Math.ceil(daysDiff / 7);
        break;
      case 'monthly':
        periodCount = Math.ceil(daysDiff / 30.44); // Approximate months
        break;
    }

    return { startDate, endDate, periodCount };
  }

  /**
   * Write trend overview section
   * @param {WriteStream} stream - Output stream
   * @param {Object[]} trends - Trend data
   */
  writeOverview(stream, trends) {
    const totalCommits = trends.reduce((sum, t) => sum + t.metrics.commitCount, 0);
    const mostActive = trends.reduce((max, t) => t.metrics.commitCount > max.count ? 
      { date: t.startDate, count: t.metrics.commitCount } : max, 
      { date: '', count: 0 });
    
    const allTypes = trends.reduce((types, t) => {
      Object.entries(t.metrics.commitTypes).forEach(([type, count]) => {
        types[type] = (types[type] || 0) + count;
      });
      return types;
    }, {});
    
    const primaryType = Object.entries(allTypes)
      .sort((a, b) => b[1] - a[1])[0];
    
    stream.write('## Overview\n');
    stream.write(`- Period: ${new Date(this.startDate).toLocaleDateString('en-US')} to ${new Date(this.endDate).toLocaleDateString('en-US')}\n`);
    stream.write(`- Total Commits: ${totalCommits}\n`);
    if (mostActive.count > 0) {
      stream.write(`- Most Active ${this.period === 'daily' ? 'Day' : this.period === 'weekly' ? 'Week' : 'Month'}: ${new Date(mostActive.date).toLocaleDateString('en-US')} (${mostActive.count} commits)\n`);
    }
    if (primaryType) {
      const percentage = Math.round((primaryType[1] / totalCommits) * 100);
      stream.write(`- Primary Contribution Type: ${primaryType[0]} (${percentage}%)\n`);
    }
    stream.write('\n');
  }

  /**
   * Write detailed trend breakdown
   * @param {WriteStream} stream - Output stream
   * @param {Object[]} trends - Trend data
   */
  writeBreakdown(stream, trends) {
    stream.write(`## ${this.period.charAt(0).toUpperCase() + this.period.slice(1)} Breakdown\n\n`);

    for (const trend of trends) {
      const date = new Date(trend.startDate);
      const dateStr = this.period === 'daily' 
        ? date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
        : this.period === 'weekly'
          ? `Week of ${date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`
          : date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });

      stream.write(`### ${dateStr}\n`);
      stream.write(`Commits: ${trend.metrics.commitCount}\n\n`);

      if (trend.metrics.commitCount > 0) {
        // Time distribution
        stream.write('Time Distribution:\n');
        const { morningPercent, afternoonPercent, eveningPercent } = trend.metrics.timeDistribution;
        stream.write(`- 🌅 Morning (5:00-11:59): ${morningPercent}%\n`);
        stream.write(`- 🌞 Afternoon (12:00-16:59): ${afternoonPercent}%\n`);
        stream.write(`- 🌙 Evening (17:00-4:59): ${eveningPercent}%\n\n`);

        // Commit types
        if (Object.keys(trend.metrics.commitTypes).length > 0) {
          stream.write('Commit Types:\n');
          Object.entries(trend.metrics.commitTypes)
            .sort((a, b) => b[1] - a[1])
            .forEach(([type, count]) => {
              stream.write(`- ${type}: ${count}\n`);
            });
          stream.write('\n');
        }
      }
    }
  }

  /**
   * Execute the trend command
   */
  async execute() {
    try {
      if (!await isGitRepository()) {
        throw new GitLogError(
          'Not a git repository. Please run this command from within a git repository.',
          'NOT_GIT_REPO'
        );
      }

      console.log(`${colors.blue}Generating ${this.period} trend for author: ${colors.bright}${this.author}${colors.reset}`);
      
      const { startDate, endDate, periodCount } = this.calculateDateRange();
      this.startDate = startDate;
      this.endDate = endDate;

      const userTimezoneOffset = new Date().getTimezoneOffset();
      const userTimezone = -userTimezoneOffset / 60;

      const trends = await getRollingTrends(
        this.author,
        this.period,
        periodCount,
        endDate,
        this.includeDirs,
        this.excludeDirs,
        userTimezone
      );


      const trendFile = this.writer.generateFilename(this.author, `${this.period}_trend`);
      const trendStream = this.writer.createStream(trendFile);

      this.writer.writeHeader(trendStream, 
        `${this.period.charAt(0).toUpperCase() + this.period.slice(1)} Contribution Trend for ${this.author}`,
        {
          since: this.since,
          until: this.until,
          includeDirs: this.includeDirs,
          excludeDirs: this.excludeDirs
        }
      );

      this.writeOverview(trendStream, trends);
      this.writeBreakdown(trendStream, trends);

      await this.writer.closeStream(trendStream);
      this.writer.logSuccess('trend', trendFile);

      return { trendFile };
    } catch (error) {
      if (error instanceof GitLogError) {
        throw error;
      }
      throw new GitLogError(
        'Error generating trend log: ' + error.message,
        'TREND_GENERATION_FAILED',
        { error: error.message }
      );
    }
  }
}

module.exports = TrendCommand;
