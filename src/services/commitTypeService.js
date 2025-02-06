/**
 * @module commitTypeService
 * @description Service for analyzing and categorizing git commits based on their type and content
 */

/**
 * @constant {Object} COMMIT_TYPES
 * @description Mapping of commit types to their identifying patterns
 * @property {Object} FEATURE - Patterns for feature-related commits
 * @property {Object} BUG_FIX - Patterns for bug fix commits
 * @property {Object} REFACTOR - Patterns for code refactoring commits
 * @property {Object} DOCS - Patterns for documentation commits
 * @property {Object} TEST - Patterns for test-related commits
 * @property {Object} CONFIG - Patterns for configuration and build commits
 */
const COMMIT_TYPES = {
  FEATURE: {
    patterns: [/^feat:/, /^add:/, /^new:/],
    filePatterns: [/^(?!.*test).+\.(js|ts|jsx|tsx)$/]
  },
  BUG_FIX: {
    patterns: [/^fix:/, /^bug:/, /^issue:/, /^hotfix:/],
    filePatterns: [/^(?!.*test).+\.(js|ts|jsx|tsx)$/]
  },
  REFACTOR: {
    patterns: [/^refactor:/, /^clean:/, /^restructure:/, /^improve:/],
    filePatterns: [/^(?!.*test).+\.(js|ts|jsx|tsx)$/]
  },
  DOCS: {
    patterns: [/^docs:/, /^documentation:/],
    filePatterns: [/\.md$/, /docs\//, /README/]
  },
  TEST: {
    patterns: [/^test:/, /^testing:/],
    filePatterns: [/test/, /spec\.(js|ts)$/]
  },
  CONFIG: {
    patterns: [/^config:/, /^chore:/, /^build:/],
    filePatterns: [/\.(json|yml|yaml|config\.js)$/]
  }
};

/**
 * Checks if text matches any of the given regex patterns
 * @private
 * @param {string} text - Text to check against patterns
 * @param {Array<RegExp>} patterns - Array of regex patterns to match against
 * @returns {boolean} True if text matches any pattern
 */
const matchesPatterns = (text, patterns) => {
  if (!text) return false;
  const normalizedText = text.toLowerCase().trim();
  return patterns.some(pattern => pattern.test(normalizedText));
};

/**
 * Checks if any file in the list matches any of the given regex patterns
 * @private
 * @param {Array<string>} files - List of file paths to check
 * @param {Array<RegExp>} patterns - Array of regex patterns to match against
 * @returns {boolean} True if any file matches any pattern
 */
const matchesFilePatterns = (files, patterns) => {
  if (!files || !files.length) return false;
  return files.some(file => patterns.some(pattern => pattern.test(file)));
};

/**
 * Categorizes a commit into one or more types based on its message and modified files
 * @param {Object} commit - Commit object to categorize
 * @param {string} commit.message - Commit message
 * @param {Array<string>} commit.files - List of files modified in the commit
 * @returns {Array<string>} Array of commit types assigned to the commit
 */
const categorizeCommit = (commit) => {
  const types = new Set();
  const message = commit?.message || '';
  const files = commit?.files || [];

  // Check message patterns first
  Object.entries(COMMIT_TYPES).forEach(([type, { patterns }]) => {
    if (matchesPatterns(message, patterns)) {
      types.add(type);
    }
  });

  // For test files, always add TEST type regardless of message
  if (files.some(file => /test|spec\.(js|ts)$/.test(file))) {
    types.add('TEST');
  }

  // If no types found from message, try to determine one type from file patterns
  if (types.size === 0) {
    // Try to find the most specific matching type based on file patterns
    for (const [type, { filePatterns }] of Object.entries(COMMIT_TYPES)) {
      if (matchesFilePatterns(files, filePatterns)) {
        types.add(type);
        break; // Only use the first matching type
      }
    }
  }

  return Array.from(types);
};

/**
 * Calculates metrics about commit types across a set of commits
 * @param {Array<Object>} commits - Array of commit objects to analyze
 * @returns {Object} Metrics object containing type breakdown and primary contribution type
 * @property {Array<{type: string, count: number, percentage: string}>} typeBreakdown - Breakdown of commit types with counts and percentages
 * @property {string} primaryContributionType - Most frequent commit type
 */
const calculateTypeMetrics = (commits) => {
  const typeCounts = {};

  commits.forEach(commit => {
    const types = categorizeCommit(commit);
    if (types.length === 0) {
      typeCounts['UNKNOWN'] = (typeCounts['UNKNOWN'] || 0) + 1;
    } else {
      types.forEach(type => {
        typeCounts[type] = (typeCounts[type] || 0) + 1;
      });
    }
  });

  // Calculate total type assignments
  const totalTypeAssignments = Object.values(typeCounts).reduce((sum, count) => sum + count, 0);

  // Calculate percentages based on total type assignments
  const typeBreakdown = Object.entries(typeCounts).map(([type, count]) => ({
    type,
    count,
    percentage: ((count / totalTypeAssignments) * 100).toFixed(2)
  }));

  // Sort by count and then alphabetically for consistent ordering
  const sortedTypes = typeBreakdown.sort((a, b) => {
    const countDiff = b.count - a.count;
    return countDiff !== 0 ? countDiff : a.type.localeCompare(b.type);
  });

  return {
    typeBreakdown: sortedTypes,
    primaryContributionType: sortedTypes.length > 0 && sortedTypes[0].type !== 'UNKNOWN' ? 
      sortedTypes[0].type : 'UNKNOWN'
  };
};

module.exports = {
  COMMIT_TYPES,
  categorizeCommit,
  calculateTypeMetrics
};
