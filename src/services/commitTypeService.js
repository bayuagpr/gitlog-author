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

const matchesPatterns = (text, patterns) => {
  if (!text) return false;
  const normalizedText = text.toLowerCase().trim();
  return patterns.some(pattern => pattern.test(normalizedText));
};

const matchesFilePatterns = (files, patterns) => {
  if (!files || !files.length) return false;
  return files.some(file => patterns.some(pattern => pattern.test(file)));
};

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
