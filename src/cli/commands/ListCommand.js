const CommandHandler = require('./CommandHandler');
const { colors } = require('../../constants');
const { isGitRepository, getAllAuthors } = require('../../services/gitOperations');
const GitLogError = require('../../models/GitLogError');

/**
 * @class ListCommand
 * @description Handles listing of repository authors
 */
class ListCommand extends CommandHandler {
  /**
   * Execute the list command
   */
  async execute() {
    try {
      if (!await isGitRepository()) {
        throw new GitLogError(
          'Not a git repository. Please run this command from within a git repository.',
          'NOT_GIT_REPO'
        );
      }

      console.log(`${colors.blue}Fetching all authors...${colors.reset}`);
      const authors = await getAllAuthors();
      
      if (!authors.length) {
        console.log(`${colors.yellow}No commits found in this repository${colors.reset}`);
        return;
      }

      console.log(`\n${colors.bright}Authors in this repository:${colors.reset}\n`);
      authors.forEach(author => {
        console.log(`${colors.green}${author.commits.toString().padStart(4)}${colors.reset} ${author.name} <${author.email}>`);
      });
      console.log(`\n${colors.bright}Total authors: ${authors.length}${colors.reset}`);
      
      return { authors };
    } catch (error) {
      if (error instanceof GitLogError) {
        throw error;
      }
      throw new GitLogError(
        'Error listing authors: ' + error.message,
        'LIST_AUTHORS_FAILED',
        { error: error.message }
      );
    }
  }
}

module.exports = ListCommand;
