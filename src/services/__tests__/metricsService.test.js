const { parseGitStats, analyzeFileImpact, calculateVelocityMetrics } = require('../metricsService');
const { getCommitDetails } = require('../authorService');

jest.mock('../authorService');

describe('Metrics Service', () => {
  describe('parseGitStats', () => {
    it('should return null for empty input', () => {
      expect(parseGitStats('')).toBeNull();
      expect(parseGitStats(null)).toBeNull();
      expect(parseGitStats(undefined)).toBeNull();
    });

    it('should parse git stats output correctly', () => {
      const statsOutput = '2 files changed, 10 insertions(+), 5 deletions(-)';
      const result = parseGitStats(statsOutput);

      expect(result).toEqual({
        filesChanged: 2,
        insertions: 10,
        deletions: 5,
        totalChanges: 15
      });
    });

    it('should handle missing stats components', () => {
      const statsOutput = '2 files changed';
      const result = parseGitStats(statsOutput);

      expect(result).toEqual({
        filesChanged: 2,
        insertions: 0,
        deletions: 0,
        totalChanges: 0
      });
    });

    it('should handle single file changes', () => {
      const statsOutput = '1 file changed, 1 insertion(+)';
      const result = parseGitStats(statsOutput);

      expect(result).toEqual({
        filesChanged: 1,
        insertions: 1,
        deletions: 0,
        totalChanges: 1
      });
    });
  });

  describe('analyzeFileImpact', () => {
    it('should return null for empty input', () => {
      expect(analyzeFileImpact('')).toBeNull();
      expect(analyzeFileImpact(null)).toBeNull();
      expect(analyzeFileImpact(undefined)).toBeNull();
    });

    it('should filter out excluded files', () => {
      const statsOutput = `
        node_modules/package/index.js | 10
        src/components/App.js | 20
        dist/bundle.js | 30
      `;
      const result = analyzeFileImpact(statsOutput);
      
      const hasExcludedFiles = result.topFiles.some(([file]) => 
        file.includes('node_modules/') || file.includes('dist/')
      );
      expect(hasExcludedFiles).toBe(false);
      
      const appFileFound = result.topFiles.some(([file]) => file.includes('App.js'));
      expect(appFileFound).toBe(true);
    });

    it('should calculate directory impact correctly', () => {
      const statsOutput = `
        src/components/Button.js | 10
        src/components/Input.js | 20
        src/utils/helper.js | 15
      `;
      const result = analyzeFileImpact(statsOutput);

      expect(result.directoryImpact).toHaveLength(2);
      
      const componentDir = result.directoryImpact.find(d => d.directory === 'src/components');
      const utilsDir = result.directoryImpact.find(d => d.directory === 'src/utils');
      
      expect(componentDir).toBeTruthy();
      expect(utilsDir).toBeTruthy();
      expect(componentDir.changes).toBe(30); // 10 + 20
      expect(utilsDir.changes).toBe(15);
    });

    it('should sort and limit top files', () => {
      const statsOutput = `
        src/file1.js | 10
        src/file2.js | 30
        src/file3.js | 20
        src/file4.js | 40
        src/file5.js | 25
        src/file6.js | 15
      `;
      const result = analyzeFileImpact(statsOutput);

      expect(result.topFiles).toHaveLength(5); // Should limit to top 5
      expect(result.topFiles[0][1]).toBe(40); // First should be highest
      expect(result.topFiles[4][1]).toBe(15); // Last should be lowest in top 5
    });
  });

  describe('calculateVelocityMetrics', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should handle empty or invalid input', async () => {
      const result = await calculateVelocityMetrics([]);
      expect(result).toEqual({
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
        }
      });
    });

    it('should calculate velocity metrics correctly', async () => {
      const mockCommits = [
        { hash: 'abc123', date: '2024-02-05T10:00:00Z' }, // morning
        { hash: 'def456', date: '2024-02-05T14:00:00Z' }, // afternoon
        { hash: 'ghi789', date: '2024-02-05T20:00:00Z' }  // evening
      ];

      getCommitDetails
        .mockResolvedValueOnce('2 files changed, 10 insertions(+), 5 deletions(-)\nsrc/file1.js | 15')
        .mockResolvedValueOnce('1 file changed, 5 insertions(+)\nsrc/file2.js | 5')
        .mockResolvedValueOnce('3 files changed, 20 insertions(+), 10 deletions(-)\nsrc/file3.js | 30');

      const result = await calculateVelocityMetrics(mockCommits);

      expect(result.totalLinesChanged).toBe(50); // 15 + 5 + 30
      expect(result.averageCommitSize).toBe(17); // 50 / 3 rounded
      expect(result.commitsPerDay).toBe(3);
      expect(result.timeDistribution).toEqual({
        morning: 33.3,
        afternoon: 33.3,
        evening: 33.3
      });
      expect(result.impactMetrics.topFiles).toHaveLength(3);
      expect(result.impactMetrics.directoryImpact).toBeTruthy();
    });

    it('should handle commits across multiple days', async () => {
      const mockCommits = [
        { hash: 'abc123', date: '2024-02-01T10:00:00Z' },
        { hash: 'def456', date: '2024-02-05T14:00:00Z' }
      ];

      getCommitDetails
        .mockResolvedValueOnce('1 file changed, 10 insertions(+)\nsrc/file1.js | 10')
        .mockResolvedValueOnce('1 file changed, 5 insertions(+)\nsrc/file2.js | 5');

      const result = await calculateVelocityMetrics(mockCommits);

      expect(result.commitsPerDay).toBe(0.4); // 2 commits / 5 days
      expect(result.timeDistribution).toEqual({
        morning: 50,
        afternoon: 50,
        evening: 0
      });
    });
  });
});
