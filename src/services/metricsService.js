const path = require('path');
const { EXCLUDED_PATTERNS, SOURCE_PATTERNS } = require('../constants');
const { getCommitDetails } = require('./authorService');
const { calculateTypeMetrics } = require('./commitTypeService');

function shouldIncludeFile(filePath) {
  if (EXCLUDED_PATTERNS.some(pattern => pattern.test(filePath))) {
    return false;
  }
  return SOURCE_PATTERNS.some(pattern => pattern.test(filePath));
}

function groupPaths(paths) {
  const groups = new Map();
  
  paths.forEach(({ directory, changes, percentage }) => {
    const parts = directory.split('/');
    let currentPath = '';
    let currentGroup = groups;

    parts.forEach((part, index) => {
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      if (index === parts.length - 1) {
        if (!currentGroup.has(currentPath)) {
          currentGroup.set(currentPath, { changes, percentage, subPaths: new Map() });
        }
      } else {
        if (!currentGroup.has(currentPath)) {
          currentGroup.set(currentPath, { changes: 0, percentage: 0, subPaths: new Map() });
        }
        currentGroup = currentGroup.get(currentPath).subPaths;
      }
    });
  });

  return groups;
}

function analyzeFileImpact(statsOutput) {
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
      
      if (!shouldIncludeFile(filePath)) continue;
      
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

  const filesMatch = summaryLine.match(/(\d+) files? changed/);
  const insertionsMatch = summaryLine.match(/(\d+) insertions?\(\+\)/);
  const deletionsMatch = summaryLine.match(/(\d+) deletions?\(-\)/);

  if (filesMatch) stats.filesChanged = parseInt(filesMatch[1], 10);
  if (insertionsMatch) stats.insertions = parseInt(insertionsMatch[1], 10);
  if (deletionsMatch) stats.deletions = parseInt(deletionsMatch[1], 10);
  
  stats.totalChanges = stats.insertions + stats.deletions;

  return stats;
}

async function calculateVelocityMetrics(commits) {
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
      }
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
    const impact = analyzeFileImpact(details);
    
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
    const hour = commitDate.getHours();
    
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
        }))
    },
    typeMetrics
  };

  return metrics;
}

module.exports = {
  calculateVelocityMetrics,
  parseGitStats,
  analyzeFileImpact
};
