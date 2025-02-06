/**
 * @module fileUtils
 * @description Utility functions for file system operations and path handling
 */

const fs = require('fs');
const path = require('path');

/**
 * Sanitizes a filename by removing invalid characters and normalizing spaces
 * @param {string} filename - Original filename to sanitize
 * @returns {string} Sanitized filename safe for file system operations
 * @description Removes special characters, converts spaces to hyphens, and limits length to 255 characters
 */
function sanitizeFilename(filename) {
  return filename
    .replace(/[\/\\?%*:|"<>]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 255);
}

/**
 * Creates a directory if it doesn't exist
 * @param {string} dirPath - Path of directory to create
 * @throws {Error} If directory creation fails
 */
function ensureDirectoryExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Creates a write stream for a file, ensuring its directory exists
 * @param {string} filePath - Path where the file should be written
 * @returns {fs.WriteStream} Write stream for the file
 * @throws {Error} If stream creation fails
 */
function createWriteStream(filePath) {
  ensureDirectoryExists(path.dirname(filePath));
  return fs.createWriteStream(filePath);
}

/**
 * Validates if a string is in an acceptable date format
 * @param {string} dateString - Date string to validate
 * @returns {boolean} True if string is in valid date format
 * @description Accepts ISO 8601 dates (YYYY-MM-DD), relative dates (X days ago), and named dates (last Monday)
 */
function isValidDateFormat(dateString) {
  if (!dateString || dateString.trim() === '') return false;

  // Check for shell injection attempts
  if (/[;&|><$]/.test(dateString)) return false;

  // ISO 8601 date format (YYYY-MM-DD)
  const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;
  
  // Relative dates
  const relativeDateRegex = /^(\d+\s+)?(day|week|month|year)s?\s+ago$|^yesterday$/i;
  
  // Named dates
  const namedDateRegex = /^last\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday|month|year)$/i;

  return isoDateRegex.test(dateString) || 
         relativeDateRegex.test(dateString) || 
         namedDateRegex.test(dateString);
}

module.exports = {
  sanitizeFilename,
  ensureDirectoryExists,
  createWriteStream,
  isValidDateFormat
};
