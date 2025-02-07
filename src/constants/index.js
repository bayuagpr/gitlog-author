// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  blue: '\x1b[34m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  green: '\x1b[32m'
};

// File patterns to exclude from analysis
const EXCLUDED_PATTERNS = [
  /package-lock\.json$/,
  /yarn\.lock$/,
  /\.min\.(js|css)$/,
  /\.(map|d\.ts)$/,
  /^node_modules\//,
  /^dist\//,
  /^build\//,
  /^\.nx\//,
  /^coverage\//,
  /^\.next\//,
  /^\.cache\//
];

// Source code file patterns
const SOURCE_PATTERNS = [
  /\.(js|jsx|ts|tsx)$/,
  /\.(css|scss|sass|less|styl)$/,
  /\.html?$/,
  /\.(test|spec)\.(js|jsx|ts|tsx)$/,
  /\.(md|mdx)$/
];

const { RISK_PATTERNS, FILE_PATTERNS } = require('./reviewPatterns');

module.exports = {
  colors,
  EXCLUDED_PATTERNS,
  SOURCE_PATTERNS,
  RISK_PATTERNS,
  FILE_PATTERNS
};
