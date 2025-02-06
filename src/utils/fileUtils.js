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

module.exports = {
  sanitizeFilename,
  ensureDirectoryExists,
  createWriteStream
}; 