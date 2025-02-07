const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { execGitCommand, isGitRepository } = require('../gitOperations');
const { getAuthorCommits } = require('../authorService');


describe('Git Operations Integration Tests', () => {
  const testRepoPath = path.join(__dirname, 'test-repo');
  const testAuthor = 'Test User <test@example.com>';
  let originalCwd;

  beforeAll(async () => {
    try {
      originalCwd = process.cwd();
      if (fs.existsSync(testRepoPath)) {
        fs.rmSync(testRepoPath, { recursive: true, force: true });
      }
      fs.mkdirSync(testRepoPath);
      process.chdir(testRepoPath);

      execSync('git init --initial-branch=main');
      execSync('git config --local core.safedir true');
      execSync('git config --local user.name "Test User"');
      execSync('git config --local user.email "test@example.com"');

      fs.writeFileSync('test1.txt', 'Test content 1');
      execSync('git add test1.txt');
      execSync('git commit -m "First commit" --author="' + testAuthor + '"');

      fs.writeFileSync('test2.txt', 'Test content 2\nWith Unicode: 你好');
      execSync('git add test2.txt');
      execSync('git commit -m "Second commit with 特殊字符" --author="' + testAuthor + '"');

      execSync('git checkout -b feature');
      fs.writeFileSync('test3.txt', 'Feature content');
      execSync('git add test3.txt');
      execSync('git commit -m "Feature commit" --author="' + testAuthor + '"');

      execSync('git checkout main');
    } catch (error) {
      console.error('Error in test setup:', error);
      throw error;
    }
  });

  afterAll(async () => {
    try {
      process.chdir(originalCwd);
      await new Promise(resolve => setTimeout(resolve, 100));
      if (fs.existsSync(testRepoPath)) {
        fs.rmSync(testRepoPath, { recursive: true, force: true });
      }
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  });

  describe('execGitCommand', () => {
    it('should execute git commands successfully', async () => {
      const result = await execGitCommand('git', ['status']);
      expect(result).toContain('On branch');
    });

    it('should throw error for non-git commands', async () => {
      await expect(execGitCommand('ls', [])).rejects.toThrow('Only git commands are allowed');
    });

    it('should handle git command errors gracefully', async () => {
      await expect(execGitCommand('git', ['nonexistentcommand']))
        .rejects.toThrow('Git command failed');
    });

    it('should handle UTF-8 encoded output', async () => {
      const result = await execGitCommand('git', ['log', '-1', '--format=%s']);
      expect(result).toContain('特殊字符');
    });
  });

  describe('isGitRepository', () => {
    it('should return true for valid git repository', async () => {
      const result = await isGitRepository();
      expect(result).toBe(true);
    });

    it('should handle empty repository', async () => {
      const emptyRepoPath = path.join(__dirname, 'empty-repo');
      fs.mkdirSync(emptyRepoPath, { recursive: true });
      process.chdir(emptyRepoPath);
      execSync('git init');

      try {
        await expect(isGitRepository()).rejects.toThrow('Git repository has no commits yet');
      } finally {
        process.chdir(testRepoPath);
        fs.rmSync(emptyRepoPath, { recursive: true, force: true });
      }
    });
  });

  describe('getAuthorCommits', () => {
    it('should retrieve commits for specified author', async () => {
      const commits = await getAuthorCommits('Test User', '', '', ['test1.txt', 'test2.txt', 'test3.txt', 'test4.txt']);
      const mainCommits = commits.filter(commit => 
        !commit.subject.includes('Feature') && 
        !commit.subject.includes('Past') &&
        !commit.subject.includes('empty'));
      
      expect(mainCommits).toHaveLength(2);
      expect(mainCommits[0]).toHaveProperty('subject', 'Second commit with 特殊字符');
      expect(mainCommits[1]).toHaveProperty('subject', 'First commit');
    });

    it('should retrieve commits using email', async () => {
      const commits = await getAuthorCommits('test@example.com', '', '', ['test1.txt', 'test2.txt', 'test3.txt', 'test4.txt']);
      const mainCommits = commits.filter(commit => 
        !commit.subject.includes('Feature') && 
        !commit.subject.includes('Past') &&
        !commit.subject.includes('empty'));
      
      expect(mainCommits).toHaveLength(2);
    });

    it('should return empty array for non-existent author', async () => {
      const commits = await getAuthorCommits('Non Existent');
      expect(commits).toHaveLength(0);
    });

    it('should throw error for invalid author input', async () => {
      await expect(getAuthorCommits('')).rejects.toThrow('Author name or email is required');
    });

    it('should filter commits by date range', async () => {
      execSync('git checkout main');
      fs.writeFileSync('test4.txt', 'Test content 4');
      execSync('git add test4.txt');
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);
      const isoDate = pastDate.toISOString();
      execSync(`git commit --date="${isoDate}" -m "Past commit" --author="${testAuthor}"`);

      const commits = await getAuthorCommits('Test User', isoDate, '', ['test1.txt', 'test2.txt', 'test3.txt', 'test4.txt']);
      const filteredCommit = commits.find(c => c.subject === 'Past commit');
      expect(filteredCommit).toBeTruthy();
      expect(filteredCommit.subject).toBe('Past commit');
    });

    it.skip('should handle directory filtering correctly', async () => {
      // Test include dirs
      const includeCommits = await getAuthorCommits('Test User', '', '', ['test1.txt']);
      expect(includeCommits.length).toBeGreaterThan(0);
      expect(includeCommits.some(c => c.subject === 'First commit')).toBeTruthy();
      expect(includeCommits.every(c => !c.subject.includes('Second commit'))).toBeTruthy();

      // Test exclude dirs by only excluding test2.txt
      const excludeCommits = await getAuthorCommits('Test User', '', '', [], ['test2.txt']);
      const firstCommit = excludeCommits.find(c => c.subject === 'First commit');
      const secondCommit = excludeCommits.find(c => c.subject.includes('Second commit'));
      expect(firstCommit).toBeTruthy();
      expect(secondCommit).toBeFalsy();
    });
  });
}); 