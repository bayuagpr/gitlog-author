const path = require('path');
const { createWriteStream } = require('../../utils/fileUtils');
const { colors } = require('../../constants');

/**
 * @class ReportWriter
 * @description Base class for writing report files
 */
class ReportWriter {
  /**
   * @param {string} outputDir - Directory to write reports to
   */
  constructor(outputDir = 'git-logs') {
    this.outputDir = path.join(process.cwd(), outputDir);
  }

  /**
   * Generate a timestamped filename
   * @param {string} author - Author name
   * @param {string} type - Report type
   * @returns {string} Full file path
   */
  generateFilename(author, type) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    return path.join(this.outputDir, `${this.sanitizeFilename(author)}_${type}_${timestamp}.md`);
  }

  /**
   * Create a write stream for the report file
   * @param {string} filePath - Path to create file at
   * @returns {WriteStream} Node write stream
   */
  createStream(filePath) {
    return createWriteStream(filePath);
  }

  /**
   * Write the report header
   * @param {WriteStream} stream - Output stream
   * @param {string} title - Report title
   * @param {Object} options - Header options
   * @param {string} [options.since] - Start date
   * @param {string} [options.until] - End date
   * @param {string[]} [options.includeDirs] - Included directories
   * @param {string[]} [options.excludeDirs] - Excluded directories
   */
  writeHeader(stream, title, { since = '', until = '', includeDirs = [], excludeDirs = [] } = {}) {
    stream.write(`# ${title}\n\n`);
    stream.write(`Generated on: ${new Date().toLocaleString('en-US', { timeZoneName: 'short' })}\n\n`);

    if (since || until) {
      stream.write('## Date Range\n');
      if (since) stream.write(`From: ${since}\n`);
      if (until) stream.write(`To: ${until}\n`);
      stream.write('\n');
    }

    if (includeDirs.length > 0 || excludeDirs.length > 0) {
      stream.write('## Directory Scope\n');
      if (includeDirs.length > 0) {
        stream.write('Including only:\n');
        includeDirs.forEach(dir => {
          stream.write(`- \`${dir}\`\n`);
        });
      }
      if (excludeDirs.length > 0) {
        stream.write('Excluding:\n');
        excludeDirs.forEach(dir => {
          stream.write(`- \`${dir}\`\n`);
        });
      }
      stream.write('\n');
    }
  }

  /**
   * Close the write stream
   * @param {WriteStream} stream - Stream to close
   * @returns {Promise<void>}
   */
  async closeStream(stream) {
    return new Promise((resolve, reject) => {
      stream.end(err => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  /**
   * Log file creation success
   * @param {string} type - Type of file created
   * @param {string} filePath - Path to created file
   */
  logSuccess(type, filePath) {
    console.log(`${colors.green}✓ Generated ${type} file: ${colors.reset}${filePath}`);
  }

  /**
   * Sanitize filename to be safe for filesystem
   * @private
   * @param {string} filename - Raw filename
   * @returns {string} Sanitized filename
   */
  sanitizeFilename(filename) {
    return filename.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_');
  }
}

module.exports = ReportWriter;
