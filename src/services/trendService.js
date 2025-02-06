const { getAuthorCommits } = require('./authorService');
const { categorizeCommit } = require('./commitTypeService');

const PERIODS = {
  daily: {
    unit: 'day',
    format: (date) => date.toISOString().split('T')[0],
    startOf: (date) => {
      const newDate = new Date(date);
      newDate.setUTCHours(0, 0, 0, 0);
      return newDate;
    },
    endOf: (date) => {
      const newDate = new Date(date);
      newDate.setUTCHours(23, 59, 59, 999);
      return newDate;
    }
  },
  weekly: {
    unit: 'week',
    format: (date) => {
      const startOfWeek = new Date(date);
      startOfWeek.setUTCDate(date.getUTCDate() - date.getUTCDay());
      return startOfWeek.toISOString().split('T')[0];
    },
    startOf: (date) => {
      const startOfWeek = new Date(date);
      startOfWeek.setUTCDate(startOfWeek.getUTCDate() - startOfWeek.getUTCDay());
      startOfWeek.setUTCHours(0, 0, 0, 0);
      return startOfWeek;
    },
    endOf: (date) => {
      const endOfWeek = new Date(date);
      endOfWeek.setUTCDate(endOfWeek.getUTCDate() + (6 - endOfWeek.getUTCDay()));
      endOfWeek.setUTCHours(23, 59, 59, 999);
      return endOfWeek;
    }
  },
  monthly: {
    unit: 'month',
    format: (date) => date.toISOString().slice(0, 7),
    startOf: (date) => {
      const newDate = new Date(Date.UTC(
        date.getUTCFullYear(),
        date.getUTCMonth(),
        1,
        0, 0, 0, 0
      ));
      return newDate;
    },
    endOf: (date) => {
      const newDate = new Date(Date.UTC(
        date.getUTCFullYear(),
        date.getUTCMonth() + 1,
        0,
        23, 59, 59, 999
      ));
      return newDate;
    }
  },
  yearly: {
    unit: 'year',
    format: (date) => date.getFullYear().toString(),
    startOf: (date) => {
      const newDate = new Date(Date.UTC(
        date.getUTCFullYear(),
        0,
        1,
        0, 0, 0, 0
      ));
      return newDate;
    },
    endOf: (date) => {
      const newDate = new Date(Date.UTC(
        date.getUTCFullYear(),
        11,
        31,
        23, 59, 59, 999
      ));
      return newDate;
    }
  }
};

function getTimeOfDay(dateStr) {
  const date = new Date(dateStr);
  const hour = date.getUTCHours();
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  return 'evening';
}

function filterCommitsByPeriod(commits, startDate, endDate) {
  return commits.filter(commit => {
    const commitDate = new Date(commit.date);
    return commitDate >= startDate && commitDate <= endDate;
  });
}

async function calculateTrendMetrics(commits) {
  const timeDistribution = {
    morning: 0,
    afternoon: 0,
    evening: 0,
    morningPercent: 0,
    afternoonPercent: 0,
    eveningPercent: 0
  };

  const commitTypes = {};

  commits.forEach(commit => {
    // Calculate time distribution
    const timeOfDay = getTimeOfDay(commit.date);
    timeDistribution[timeOfDay]++;

    // Calculate commit types
    const types = categorizeCommit({
      message: commit.subject,
      files: [] // We don't have files here, but the categorization will work based on commit message
    });

    types.forEach(type => {
      commitTypes[type] = (commitTypes[type] || 0) + 1;
    });
  });

  // Calculate percentages
  const total = commits.length;
  if (total > 0) {
    timeDistribution.morningPercent = Math.round((timeDistribution.morning / total) * 100);
    timeDistribution.afternoonPercent = Math.round((timeDistribution.afternoon / total) * 100);
    timeDistribution.eveningPercent = Math.round((timeDistribution.evening / total) * 100);
  }

  return {
    commitCount: commits.length,
    timeDistribution,
    commitTypes
  };
}

async function getTrends(author, period, date = new Date(), includeDirs = [], excludeDirs = []) {
  if (!PERIODS[period]) {
    throw new Error(`Invalid period: ${period}. Must be one of: ${Object.keys(PERIODS).join(', ')}`);
  }

  const periodConfig = PERIODS[period];
  const startDate = periodConfig.startOf(new Date(date));
  const endDate = periodConfig.endOf(new Date(date));

  const commits = await getAuthorCommits(
    author,
    startDate.toISOString(),
    endDate.toISOString(),
    includeDirs,
    excludeDirs
  );

  const metrics = await calculateTrendMetrics(commits);

  return {
    period,
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    metrics
  };
}

async function compareTrends(author, period, date1, date2, includeDirs = [], excludeDirs = []) {
  const [trends1, trends2] = await Promise.all([
    getTrends(author, period, date1, includeDirs, excludeDirs),
    getTrends(author, period, date2, includeDirs, excludeDirs)
  ]);

  return [trends1, trends2];
}

async function getRollingTrends(author, period, count, endDate = new Date(), includeDirs = [], excludeDirs = []) {
  if (!PERIODS[period]) {
    throw new Error(`Invalid period: ${period}`);
  }

  const trends = [];

  for (let i = 0; i < count; i++) {
    const date = new Date(endDate);
    
    // Adjust date based on period
    switch (period) {
      case 'daily':
        date.setUTCDate(date.getUTCDate() - i);
        break;
      case 'weekly':
        date.setUTCDate(date.getUTCDate() - (i * 7));
        break;
      case 'monthly':
        date.setUTCMonth(date.getUTCMonth() - i);
        break;
      case 'yearly':
        date.setUTCFullYear(date.getUTCFullYear() - i);
        break;
    }

    const trend = await getTrends(author, period, date, includeDirs, excludeDirs);
    trends.push(trend);
  }

  return trends;
}

module.exports = {
  getTrends,
  compareTrends,
  getRollingTrends
};
