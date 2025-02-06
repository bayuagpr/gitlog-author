const { categorizeCommit, calculateTypeMetrics } = require('../commitTypeService');

describe('commitTypeService', () => {
  describe('categorizeCommit', () => {
    test('should categorize feature commits', () => {
      const commit = {
        message: 'feat: add new login functionality',
        files: ['src/auth/login.js']
      };
      expect(categorizeCommit(commit)).toContain('FEATURE');
    });

    test('should categorize bug fix commits', () => {
      const commit = {
        message: 'fix: resolve login error',
        files: ['src/auth/login.js']
      };
      expect(categorizeCommit(commit)).toContain('BUG_FIX');
    });

    test('should categorize documentation commits', () => {
      const commit = {
        message: 'docs: update README',
        files: ['README.md']
      };
      expect(categorizeCommit(commit)).toContain('DOCS');
    });

    test('should categorize test commits', () => {
      const commit = {
        message: 'test: add login tests',
        files: ['src/auth/__tests__/login.test.js']
      };
      expect(categorizeCommit(commit)).toContain('TEST');
    });

    test('should handle multiple categories', () => {
      const commit = {
        message: 'fix: update login and add tests',
        files: ['src/auth/login.js', 'src/auth/__tests__/login.test.js']
      };
      const types = categorizeCommit(commit);
      expect(types).toContain('BUG_FIX');
      expect(types).toContain('TEST');
    });
  });

  describe('calculateTypeMetrics', () => {
    test('should calculate type breakdown and primary type', () => {
      const commits = [
        { message: 'feat: new feature', files: ['src/feature.js'] },
        { message: 'fix: bug fix', files: ['src/bug.js'] },
        { message: 'feat: another feature', files: ['src/another.js'] }
      ];

      const metrics = calculateTypeMetrics(commits);
      
      const featureMetric = metrics.typeBreakdown.find(m => m.type === 'FEATURE');
      const bugFixMetric = metrics.typeBreakdown.find(m => m.type === 'BUG_FIX');
      
      expect(featureMetric).toBeDefined();
      expect(bugFixMetric).toBeDefined();
      expect(metrics.primaryContributionType).toBe('FEATURE');
      
      expect(featureMetric.count).toBe(2);
      expect(featureMetric.percentage).toBe('66.67');
      expect(bugFixMetric.percentage).toBe('33.33');
    });

    test('should handle unknown commit types', () => {
      const commits = [
        { message: 'random commit', files: ['random.txt'] }
      ];

      const metrics = calculateTypeMetrics(commits);
      expect(metrics.primaryContributionType).toBe('UNKNOWN');
      expect(metrics.typeBreakdown).toHaveLength(1);
      expect(metrics.typeBreakdown[0].type).toBe('UNKNOWN');
      expect(metrics.typeBreakdown[0].percentage).toBe('100.00');
    });
  });
}); 