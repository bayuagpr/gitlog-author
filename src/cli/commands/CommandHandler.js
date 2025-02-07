/**
 * @class CommandHandler
 * @description Base class for handling CLI commands
 */
class CommandHandler {
  /**
   * @param {string[]} args - Command line arguments
   */
  constructor(args) {
    this.args = args;
  }

  /**
   * Extract named argument value from command line args
   * @param {string} name - Argument name (without --)
   * @param {string} [defaultValue=''] - Default value if arg not found
   * @returns {string} Argument value
   */
  getArg(name, defaultValue = '') {
    const arg = this.args.find(arg => arg.startsWith(`--${name}=`));
    return arg ? arg.split('=')[1] : defaultValue;
  }

  /**
   * Check if flag argument exists
   * @param {string} name - Flag name (without --)
   * @returns {boolean} True if flag exists
   */
  hasFlag(name) {
    return this.args.includes(`--${name}`);
  }

  /**
   * Parse directory list from comma-separated string
   * @param {string} name - Argument name (without --)
   * @returns {string[]} Array of directory paths
   */
  getDirList(name) {
    const dirs = this.getArg(name);
    return dirs ? dirs.split(',') : [];
  }

  /**
   * Validate that command arguments are valid
   * @abstract
   * @throws {GitLogError} If validation fails
   */
  validateArgs() {
    throw new Error('validateArgs must be implemented by subclass');
  }

  /**
   * Execute the command
   * @abstract
   * @returns {Promise<void>}
   */
  async execute() {
    throw new Error('execute must be implemented by subclass');
  }
}

module.exports = CommandHandler;
