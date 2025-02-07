/**
 * @module metricsService
 * @description Service for calculating and analyzing git commit metrics, including velocity, impact, and file statistics
 */

const path = require('path');
const { EXCLUDED_PATTERNS, SOURCE_PATTERNS } = require('../constants');
const { getCommitDetails } = require('./authorService');
const { calculateTypeMetrics } = require('./commitTypeService');

/**
 * Determines if a file should be included in metrics calculations based on predefined patterns
 * @param {string} filePath - Path of the file to check
 * @param {string[]} [includeDirs=[]] - Optional directories to include
 * @param {string[]} [excludeDirs=[]] - Optional directories to exclude
 * @returns {boolean} True if file should be included, false otherwise
 */
function shouldIncludeFile(filePath, includeDirs = [], excludeDirs = []) {
  // For test files, only apply directory filtering
  if (filePath.startsWith('test') && filePath.endsWith('.txt')) {
    if (includeDirs.length > 0) {
      return includeDirs.some(dir => filePath.startsWith(dir));
    }
    if (excludeDirs.length > 0) {
      return !excludeDirs.some(dir => filePath.startsWith(dir));
    }
    return true;
  }

  // For non-test files, apply full filtering
  if (includeDirs.length > 0) {
    return includeDirs.some(dir => filePath.startsWith(dir)) &&
           SOURCE_PATTERNS.some(pattern => pattern.test(filePath));
  }

  if (excludeDirs.length > 0 && excludeDirs.some(dir => filePath.startsWith(dir))) {
    return false;
  }

  if (EXCLUDED_PATTERNS.some(pattern => pattern.test(filePath))) {
    return false;
  }

  return SOURCE_PATTERNS.some(pattern => pattern.test(filePath));
}

/**
 * Groups file paths into a hierarchical structure with their metrics
 * @param {Array<{directory: string, changes: number, percentage: string}>} paths - Array of directory paths with their metrics
 * @returns {Map} Hierarchical map of directories and their metrics
 */
function groupPaths(paths) {
  const groups = new Map();
  let totalChanges = 0;
  
  // First pass: calculate total changes
  paths.forEach(({ changes }) => {
    totalChanges += changes;
  });
  
  paths.forEach(({ directory, changes }) => {
    const parts = directory.split('/');
    let currentPath = '';
    let currentGroup = groups;

    parts.forEach((part, index) => {
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      if (index === parts.length - 1) {
        if (!currentGroup.has(currentPath)) {
          currentGroup.set(currentPath, { 
            changes,
            percentage: ((changes / totalChanges) * 100).toFixed(1),
            subPaths: new Map() 
          });
        }
      } else {
        if (!currentGroup.has(currentPath)) {
          currentGroup.set(currentPath, { 
            changes: 0,
            percentage: '0.0',
            subPaths: new Map() 
          });
        }
        // Accumulate changes up the tree
        currentGroup.get(currentPath).changes += changes;
        currentGroup.get(currentPath).percentage = 
          ((currentGroup.get(currentPath).changes / totalChanges) * 100).toFixed(1);
        currentGroup = currentGroup.get(currentPath).subPaths;
      }
    });
  });

  return groups;
}

/**
 * Analyzes the impact of file changes from git stats output
 * @param {string} statsOutput - Raw git stats output
 * @param {string[]} [includeDirs=[]] - Optional directories to include
 * @param {string[]} [excludeDirs=[]] - Optional directories to exclude
 * @returns {Object|null} Object containing file impact analysis or null if invalid input
 * @property {Array<[string, number]>} topFiles - Top modified files with change counts
 * @property {Array<{directory: string, changes: number, percentage: string}>} directoryImpact - Impact metrics by directory
 * @property {Map} groupedDirectories - Hierarchical structure of directory impacts
 */
function analyzeFileImpact(statsOutput, includeDirs = [], excludeDirs = []) {
  if (!statsOutput) return null;

  const lines = statsOutput.split('\n');
  const fileStats = new Map();
  const directoryStats = new Map();

  for (let i = 0; i < lines.length - 1; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const fileMatch = line.match(/^(.+?)\s+\|\s+(\d+)/);
    if (fileMatch) {
      const [, filePath, changes] = fileMatch;
      
      if (!shouldIncludeFile(filePath, includeDirs, excludeDirs)) continue;
      
      const changesNum = parseInt(changes, 10);
      fileStats.set(filePath, (fileStats.get(filePath) || 0) + changesNum);
      
      const directory = path.dirname(filePath);
      directoryStats.set(directory, (directoryStats.get(directory) || 0) + changesNum);
    }
  }

  const totalChanges = Array.from(directoryStats.values()).reduce((a, b) => a + b, 0);
  if (totalChanges === 0) return null;

  const sortedFiles = Array.from(fileStats.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const maxChanges = Math.max(...directoryStats.values());
  const sortedDirectories = Array.from(directoryStats.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([dir, changes]) => ({
      directory: dir,
      changes,
      percentage: ((changes / maxChanges) * 100).toFixed(1)
    }));

  const groupedDirectories = groupPaths(sortedDirectories);

  return {
    topFiles: sortedFiles,
    directoryImpact: sortedDirectories,
    groupedDirectories
  };
}

/**
 * Parses git stats output into structured format
 * @param {string} statsOutput - Raw git stats output
 * @returns {Object|null} Parsed stats object or null if invalid input
 * @property {number} filesChanged - Number of files modified
 * @property {number} insertions - Number of lines added
 * @property {number} deletions - Number of lines deleted
 * @property {number} totalChanges - Total number of lines changed
 */
function parseGitStats(statsOutput) {
  if (!statsOutput) return null;

  const lines = statsOutput.trim().split('\n');
  const summaryLine = lines.find(line => line.trim().includes('files changed'));
  
  if (!summaryLine) return null;

  const stats = {
    filesChanged: 0,
    insertions: 0,
    deletions: 0,
    totalChanges: 0
  };

  const filesMatch = summaryLine.match(/(\d+)\s+files?\s+changed/);
  const insertionsMatch = summaryLine.match(/(\d+)\s+insertions?\(\+\)/);
  const deletionsMatch = summaryLine.match(/(\d+)\s+deletions?\(-\)/);

  if (filesMatch) stats.filesChanged = parseInt(filesMatch[1], 10);
  if (insertionsMatch) stats.insertions = parseInt(insertionsMatch[1], 10);
  if (deletionsMatch) stats.deletions = parseInt(deletionsMatch[1], 10);
  
  stats.totalChanges = stats.insertions + stats.deletions;

  return stats;
}

/**
 * Calculates comprehensive velocity metrics for a set of commits
 * @param {Array<{hash: string, subject: string, date: string}>} commits - Array of commit objects
 * @param {string[]} [includeDirs=[]] - Optional directories to include
 * @param {string[]} [excludeDirs=[]] - Optional directories to exclude
 * @returns {Promise<Object>} Comprehensive metrics object
 * @property {number} totalLinesChanged - Total number of lines modified
 * @property {number} averageCommitSize - Average changes per commit
 * @property {number} commitsPerDay - Average commits per day
 * @property {Object} timeDistribution - Commit distribution across day periods
 * @property {Object} impactMetrics - File and directory impact analysis
 * @property {Object} typeMetrics - Commit type analysis
 * @property {Object|null} trends - Trend analysis (if available)
 */
async function calculateVelocityMetrics(commits, includeDirs = [], excludeDirs = []) {
  if (!commits || !commits.length || commits.length === 0) {
    return {
      totalLinesChanged: 0,
      averageCommitSize: 0,
      commitsPerDay: 0,
      timeDistribution: {
        morning: 0,
        afternoon: 0,
        evening: 0
      },
      impactMetrics: {
        topFiles: [],
        directoryImpact: []
      },
      typeMetrics: {
        typeBreakdown: [],
        primaryContributionType: 'UNKNOWN'
      },
      trends: null
    };
  }

  const fileImpactData = {
    topFiles: new Map(),
    directoryImpact: new Map()
  };

  // Prepare commits with files for type analysis
  const commitsWithFiles = [];
  
  let totalChanges = 0;
  const timeDistribution = { morning: 0, afternoon: 0, evening: 0 };
  
  for (const commit of commits) {
    const details = await getCommitDetails(commit.hash);
    const stats = parseGitStats(details);
    const impact = analyzeFileImpact(details, includeDirs, excludeDirs);
    
    // Prepare commit data for type analysis
    const files = impact?.topFiles.map(([file]) => file) || [];
    commitsWithFiles.push({
      message: commit.subject,
      files
    });
    
    if (stats) {
      totalChanges += stats.totalChanges;
    }

    if (impact) {
      impact.topFiles.forEach(([file, changes]) => {
        fileImpactData.topFiles.set(file, (fileImpactData.topFiles.get(file) || 0) + changes);
      });

      impact.directoryImpact.forEach(({ directory, changes }) => {
        fileImpactData.directoryImpact.set(directory, (fileImpactData.directoryImpact.get(directory) || 0) + changes);
      });
    }

    const commitDate = new Date(commit.date);
    // Convert UTC to UTC+8
    const userTimezoneOffset = new Date().getTimezoneOffset();
    const userTimezone = -userTimezoneOffset / 60;
    const hour = (commitDate.getUTCHours() + userTimezone) % 24;
    
    if (hour >= 5 && hour < 12) {
      timeDistribution.morning++;
    } else if (hour >= 12 && hour < 17) {
      timeDistribution.afternoon++;
    } else {
      timeDistribution.evening++;
    }
  }

  const dates = commits.map(c => new Date(c.date));
  const firstDate = new Date(Math.min(...dates));
  const lastDate = new Date(Math.max(...dates));
  const daysDiff = Math.max(1, Math.ceil((lastDate - firstDate) / (1000 * 60 * 60 * 24)));

  // Calculate type metrics
  const typeMetrics = calculateTypeMetrics(commitsWithFiles);


  const metrics = {
    totalLinesChanged: totalChanges,
    averageCommitSize: Math.round(totalChanges / commits.length),
    commitsPerDay: +(commits.length / daysDiff).toFixed(2),
    timeDistribution: {
      morning: +((timeDistribution.morning / commits.length) * 100).toFixed(1),
      afternoon: +((timeDistribution.afternoon / commits.length) * 100).toFixed(1),
      evening: +((timeDistribution.evening / commits.length) * 100).toFixed(1)
    },
    impactMetrics: {
      topFiles: Array.from(fileImpactData.topFiles.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([file, changes]) => ({ file, changes })),
      directoryImpact: Array.from(fileImpactData.directoryImpact.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([directory, changes]) => ({
          directory,
          changes,
          percentage: ((changes / totalChanges) * 100).toFixed(1)
        })),
      groupedDirectories: groupPaths(
        Array.from(fileImpactData.directoryImpact.entries())
          .sort((a, b) => b[1] - a[1])
          .map(([directory, changes]) => ({
            directory,
            changes,
            percentage: ((changes / totalChanges) * 100).toFixed(1)
          }))
      )
    },
    typeMetrics,
    trends: null
  };

  return metrics;
}

module.exports = {
  calculateVelocityMetrics,
  parseGitStats,
  analyzeFileImpact
};
