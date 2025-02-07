const CommandHandler = require('./CommandHandler');
const { colors } = require('../../constants');
const { isGitRepository, getAllAuthors } = require('../../services/gitOperations');
const { getAuthorCommits } = require('../../services/authorService');
const GitLogError = require('../../models/GitLogError');

/**
 * @class VerifyCommand
 * @description Handles verification of author existence and commit history
 */
class VerifyCommand extends CommandHandler {
  /**
   * @param {string[]} args - Command line arguments
   */
  constructor(args) {
    super(args);
    this.authorQuery = args[0];
    this.since = this.getArg('since');
    this.until = this.getArg('until');
  }

  /**
   * Validate command arguments
   * @throws {GitLogError} If validation fails
   */
  validateArgs() {
    if (!this.authorQuery) {
      throw new GitLogError(
        'Author name or email is required with --verify',
        'INVALID_AUTHOR'
      );
    }
  }

  /**
   * Find authors matching the query
   * @param {Object[]} authors - List of all authors
   * @returns {Object[]} Matching authors
   */
  findMatchingAuthors(authors) {
    const searchStr = this.authorQuery.toLowerCase();
    return authors.filter(author => 
      author.name.toLowerCase().includes(searchStr) || 
      author.email.toLowerCase().includes(searchStr)
    );
  }

  /**
   * Check commit history for matching authors
   * @param {Object[]} matchingAuthors - List of matching authors
   */
  async checkCommitHistory(matchingAuthors) {
    if (this.since || this.until) {
      console.log(`\n${colors.bright}Date range verification:${colors.reset}`);
      if (this.since) console.log(`From: ${this.since}`);
      if (this.until) console.log(`To: ${this.until}`);
      console.log('');

      for (const author of matchingAuthors) {
        process.stdout.write(`${colors.dim}Checking commits for ${author.name}...${colors.reset}\r`);
        const commits = await getAuthorCommits(author.name, this.since, this.until);
        if (commits.length > 0) {
          console.log(`${colors.green}✓${colors.reset} ${author.name}: ${colors.bright}${commits.length}${colors.reset} commits in this period`);
        } else {
          console.log(`${colors.yellow}○${colors.reset} ${author.name}: No commits in this period`);
        }
      }
    }
  }

  /**
   * Execute the verify command
   */
  async execute() {
    try {
      if (!await isGitRepository()) {
        throw new GitLogError(
          'Not a git repository. Please run this command from within a git repository.',
          'NOT_GIT_REPO'
        );
      }

      console.log(`${colors.blue}Verifying author: ${colors.bright}${this.authorQuery}${colors.reset}`);
      const authors = await getAllAuthors();
      
      if (!authors.length) {
        console.log(`${colors.yellow}No commits found in this repository${colors.reset}`);
        return;
      }

      const matchingAuthors = this.findMatchingAuthors(authors);

      if (matchingAuthors.length === 0) {
        console.log(`${colors.yellow}No matching authors found for: ${this.authorQuery}${colors.reset}`);
        return;
      }

      console.log(`\n${colors.bright}Matching authors:${colors.reset}\n`);
      for (const author of matchingAuthors) {
        console.log(`${colors.green}✓${colors.reset} ${author.name} <${author.email}> (${colors.bright}${author.commits}${colors.reset} commits)`);
      }

      await this.checkCommitHistory(matchingAuthors);

      const totalCommits = matchingAuthors.reduce((sum, author) => sum + author.commits, 0);
      console.log(`\n${colors.bright}Total commits by matching authors: ${colors.reset}${totalCommits}`);
      
      return { matchingAuthors };
    } catch (error) {
      if (error instanceof GitLogError) {
        throw error;
      }
      throw new GitLogError(
        'Error verifying author: ' + error.message,
        'VERIFY_AUTHOR_FAILED',
        { error: error.message }
      );
    }
  }
}

module.exports = VerifyCommand;
