class GitLogError extends Error {
  constructor(message, code, details = {}) {
    super(message);
    this.name = 'GitLogError';
    this.code = code;
    this.details = details;
  }
}

module.exports = GitLogError; 