const fs = require('fs');
const path = require('path');

function sanitizeFilename(filename) {
  return filename
    .replace(/[\/\\?%*:|"<>]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 255);
}

function ensureDirectoryExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function createWriteStream(filePath) {
  ensureDirectoryExists(path.dirname(filePath));
  return fs.createWriteStream(filePath);
}

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
