/**
 * @module GitLogError
 * @description Custom error class for git-related operations and validations
 */

/**
 * Custom error class for handling git operation failures and validation errors
 * @class
 * @extends Error
 */
class GitLogError extends Error {
  /**
   * Creates a new GitLogError instance
   * @constructor
   * @param {string} message - Human-readable error message
   * @param {string} code - Error code for programmatic handling
   * @param {Object} [details={}] - Additional error details and context
   */
  constructor(message, code, details = {}) {
    super(message);
    this.name = 'GitLogError';
    this.code = code;
    this.details = details;
  }
}

module.exports = GitLogError; 