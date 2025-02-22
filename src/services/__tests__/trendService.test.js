const { getTrends, compareTrends, getRollingTrends } = require('../trendService');
const { getAuthorCommits } = require('../authorService');

// Mock authorService
jest.mock('../authorService');

describe('TrendService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getTrends', () => {
    it('should calculate daily trends correctly', async () => {
      // Mock commit data for a single day
      getAuthorCommits.mockResolvedValue([
        {
          hash: '123',
          date: '2024-02-06T09:00:00Z',
          subject: 'feat: new feature',
          body: ''
        },
        {
          hash: '456',
          date: '2024-02-06T14:00:00Z',
          subject: 'fix: bug fix',
          body: ''
        }
      ]);

      const trends = await getTrends('john@example.com', 'daily', new Date('2024-02-06'));

      expect(trends).toEqual({
        period: 'daily',
        startDate: '2024-02-06T00:00:00.000Z',
        endDate: '2024-02-06T23:59:59.999Z',
        metrics: {
          commitCount: 2,
          timeDistribution: {
            morning: 1,
            afternoon: 1,
            evening: 0,
            morningPercent: 50,
            afternoonPercent: 50,
            eveningPercent: 0
          },
          commitTypes: {
            FEATURE: 1,
            BUG_FIX: 1
          }
        }
      });
    });

    it('should handle empty commit data', async () => {
      getAuthorCommits.mockResolvedValue([]);

      const trends = await getTrends('john@example.com', 'daily', new Date('2024-02-06'));

      expect(trends).toEqual({
        period: 'daily',
        startDate: '2024-02-06T00:00:00.000Z',
        endDate: '2024-02-06T23:59:59.999Z',
        metrics: {
          commitCount: 0,
          timeDistribution: {
            morning: 0,
            afternoon: 0,
            evening: 0,
            morningPercent: 0,
            afternoonPercent: 0,
            eveningPercent: 0
          },
          commitTypes: {}
        }
      });
    });
  });

  describe('compareTrends', () => {
    it('should compare trends between two periods', async () => {
      // First period commits
      getAuthorCommits.mockResolvedValueOnce([
        {
          hash: '123',
          date: '2024-02-06T09:00:00Z',
          subject: 'feat: new feature',
          body: ''
        }
      ]);

      // Second period commits
      getAuthorCommits.mockResolvedValueOnce([
        {
          hash: '456',
          date: '2024-02-05T14:00:00Z',
          subject: 'fix: bug fix',
          body: ''
        },
        {
          hash: '789',
          date: '2024-02-05T15:00:00Z',
          subject: 'feat: another feature',
          body: ''
        }
      ]);

      const comparison = await compareTrends(
        'john@example.com',
        'daily',
        new Date('2024-02-06'),
        new Date('2024-02-05')
      );

      expect(comparison).toHaveLength(2);
      
      // First period (one morning commit)
      expect(comparison[0].metrics.commitCount).toBe(1);
      expect(comparison[0].metrics.timeDistribution).toEqual({
        morning: 1,
        afternoon: 0,
        evening: 0,
        morningPercent: 100,
        afternoonPercent: 0,
        eveningPercent: 0
      });

      // Second period (two afternoon commits)
      expect(comparison[1].metrics.commitCount).toBe(2);
      expect(comparison[1].metrics.timeDistribution).toEqual({
        morning: 0,
        afternoon: 2,
        evening: 0,
        morningPercent: 0,
        afternoonPercent: 100,
        eveningPercent: 0
      });
    });
  });

  describe('getRollingTrends', () => {
    it('should return trends for multiple periods from current date by default', async () => {
      // Set up mock to return different commits for each call
      getAuthorCommits
        // First day
        .mockResolvedValueOnce([
          {
            hash: '123',
            date: '2024-02-06T09:00:00Z',
            subject: 'feat: new feature',
            body: ''
          }
        ])
        // Second day
        .mockResolvedValueOnce([
          {
            hash: '456',
            date: '2024-02-05T14:00:00Z',
            subject: 'fix: bug fix',
            body: ''
          }
        ])
        // Third day
        .mockResolvedValueOnce([
          {
            hash: '789',
            date: '2024-02-04T15:00:00Z',
            subject: 'feat: another feature',
            body: ''
          }
        ]);

      const trends = await getRollingTrends('john@example.com', 'daily', 3);

      expect(trends).toHaveLength(3);
      expect(trends.every(t => t.period === 'daily')).toBe(true);

      // First day (one morning commit)
      expect(trends[0].metrics.timeDistribution).toEqual({
        morning: 1,
        afternoon: 0,
        evening: 0,
        morningPercent: 100,
        afternoonPercent: 0,
        eveningPercent: 0
      });

      // Second day (one afternoon commit)
      expect(trends[1].metrics.timeDistribution).toEqual({
        morning: 0,
        afternoon: 1,
        evening: 0,
        morningPercent: 0,
        afternoonPercent: 100,
        eveningPercent: 0
      });

      // Third day (one afternoon commit)
      expect(trends[2].metrics.timeDistribution).toEqual({
        morning: 0,
        afternoon: 1,
        evening: 0,
        morningPercent: 0,
        afternoonPercent: 100,
        eveningPercent: 0
      });
    });

    it('should return trends for multiple periods from specified end date', async () => {
      // Set up mock to return commits only for the first day
      getAuthorCommits
        // First day (with commit)
        .mockResolvedValueOnce([
          {
            hash: '123',
            date: '2024-01-15T09:00:00Z',
            subject: 'feat: new feature',
            body: ''
          }
        ])
        // Second day (no commits)
        .mockResolvedValueOnce([])
        // Third day (no commits)
        .mockResolvedValueOnce([]);

      const endDate = new Date('2024-01-15');
      const trends = await getRollingTrends('john@example.com', 'daily', 3, endDate);

      expect(trends).toHaveLength(3);
      
      // First day (one morning commit)
      expect(trends[0].startDate).toBe('2024-01-15T00:00:00.000Z');
      expect(trends[0].endDate).toBe('2024-01-15T23:59:59.999Z');
      expect(trends[0].metrics.timeDistribution).toEqual({
        morning: 1,
        afternoon: 0,
        evening: 0,
        morningPercent: 100,
        afternoonPercent: 0,
        eveningPercent: 0
      });

      // Second day (no commits)
      expect(trends[1].startDate).toBe('2024-01-14T00:00:00.000Z');
      expect(trends[1].endDate).toBe('2024-01-14T23:59:59.999Z');
      expect(trends[1].metrics.timeDistribution).toEqual({
        morning: 0,
        afternoon: 0,
        evening: 0,
        morningPercent: 0,
        afternoonPercent: 0,
        eveningPercent: 0
      });

      // Third day (no commits)
      expect(trends[2].startDate).toBe('2024-01-13T00:00:00.000Z');
      expect(trends[2].endDate).toBe('2024-01-13T23:59:59.999Z');
      expect(trends[2].metrics.timeDistribution).toEqual({
        morning: 0,
        afternoon: 0,
        evening: 0,
        morningPercent: 0,
        afternoonPercent: 0,
        eveningPercent: 0
      });
    });

    it('should handle weekly trends with specified end date', async () => {
      getAuthorCommits.mockResolvedValue([]);

      const endDate = new Date('2024-01-15'); // A Monday
      const trends = await getRollingTrends('john@example.com', 'weekly', 2, endDate);

      expect(trends).toHaveLength(2);
      
      // First week (Jan 14-20)
      expect(trends[0].startDate).toBe('2024-01-14T00:00:00.000Z');
      expect(trends[0].endDate).toBe('2024-01-20T23:59:59.999Z');
      expect(trends[0].metrics.timeDistribution).toEqual({
        morning: 0,
        afternoon: 0,
        evening: 0,
        morningPercent: 0,
        afternoonPercent: 0,
        eveningPercent: 0
      });

      // Previous week (Jan 7-13)
      expect(trends[1].startDate).toBe('2024-01-07T00:00:00.000Z');
      expect(trends[1].endDate).toBe('2024-01-13T23:59:59.999Z');
      expect(trends[1].metrics.timeDistribution).toEqual({
        morning: 0,
        afternoon: 0,
        evening: 0,
        morningPercent: 0,
        afternoonPercent: 0,
        eveningPercent: 0
      });
    });

    it('should handle monthly trends with specified end date', async () => {
      getAuthorCommits.mockResolvedValue([]);

      const endDate = new Date('2024-01-15');
      const trends = await getRollingTrends('john@example.com', 'monthly', 2, endDate);

      expect(trends).toHaveLength(2);
      
      // January 2024
      expect(trends[0].startDate).toBe('2024-01-01T00:00:00.000Z');
      expect(trends[0].endDate).toBe('2024-01-31T23:59:59.999Z');
      expect(trends[0].metrics.timeDistribution).toEqual({
        morning: 0,
        afternoon: 0,
        evening: 0,
        morningPercent: 0,
        afternoonPercent: 0,
        eveningPercent: 0
      });

      // December 2023
      expect(trends[1].startDate).toBe('2023-12-01T00:00:00.000Z');
      expect(trends[1].endDate).toBe('2023-12-31T23:59:59.999Z');
      expect(trends[1].metrics.timeDistribution).toEqual({
        morning: 0,
        afternoon: 0,
        evening: 0,
        morningPercent: 0,
        afternoonPercent: 0,
        eveningPercent: 0
      });
    });
  });
});
