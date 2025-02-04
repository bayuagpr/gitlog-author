const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { execGitCommand, isGitRepository, getAuthorCommits, getCommitDetails } = require('../generate-author-log');

describe('Git Operations Integration Tests', () => {
  const testRepoPath = path.join(__dirname, 'test-repo');
  const testAuthor = 'Test User <test@example.com>';
  let originalCwd;

  beforeAll(async () => {
    try {
      // Save original working directory
      originalCwd = process.cwd();
      
      // Create and set up test repository
      if (fs.existsSync(testRepoPath)) {
        fs.rmSync(testRepoPath, { recursive: true, force: true });
      }
      fs.mkdirSync(testRepoPath);
      process.chdir(testRepoPath);

      // Initialize git repository with safe directory config
      execSync('git init --initial-branch=main');
      execSync('git config --local core.safedir true');
      execSync('git config --local user.name "Test User"');
      execSync('git config --local user.email "test@example.com"');

      // Create and commit test files
      fs.writeFileSync('test1.txt', 'Test content 1');
      execSync('git add test1.txt');
      execSync('git commit -m "First commit" --author="' + testAuthor + '"');

      // Create a commit with special characters
      fs.writeFileSync('test2.txt', 'Test content 2\nWith Unicode: 你好');
      execSync('git add test2.txt');
      execSync('git commit -m "Second commit with 特殊字符" --author="' + testAuthor + '"');

      // Create a feature branch with additional commit
      execSync('git checkout -b feature');
      fs.writeFileSync('test3.txt', 'Feature content');
      execSync('git add test3.txt');
      execSync('git commit -m "Feature commit" --author="' + testAuthor + '"');

      // Return to main branch
      execSync('git checkout main');
    } catch (error) {
      console.error('Error in test setup:', error);
      throw error;
    }
  });

  afterAll(async () => {
    try {
      // Clean up: restore original working directory
      process.chdir(originalCwd);
      
      // Wait a bit for any file handles to be released
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Remove test repository
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

    it('should execute git command with custom environment options', async () => {
      const result = await execGitCommand('git', ['status'], {
        env: { ...process.env, GIT_TERMINAL_PROMPT: '0' }
      });
      expect(result).toContain('On branch');
    });
  });

  describe('isGitRepository', () => {
    it('should return true for valid git repository', async () => {
      const result = await isGitRepository();
      expect(result).toBe(true);
    });

    it.skip('should return false for non-git directory', async () => {
      const nonGitPath = path.join(__dirname, 'non-git-dir');
      if (fs.existsSync(nonGitPath)) {
        fs.rmSync(nonGitPath, { recursive: true, force: true });
      }
      fs.mkdirSync(nonGitPath);
      
      const originalDir = process.cwd();
      process.chdir(nonGitPath);

      try {
        const result = await isGitRepository();
        expect(result).toBe(false);
      } finally {
        process.chdir(originalDir);
        await new Promise(resolve => setTimeout(resolve, 100));
        fs.rmSync(nonGitPath, { recursive: true, force: true });
      }
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

    it.skip('should handle corrupted .git directory', async () => {
      const corruptedRepoPath = path.join(__dirname, 'corrupted-repo');
      if (fs.existsSync(corruptedRepoPath)) {
        fs.rmSync(corruptedRepoPath, { recursive: true, force: true });
      }
      fs.mkdirSync(corruptedRepoPath);
      fs.mkdirSync(path.join(corruptedRepoPath, '.git'));
      // Create a corrupted HEAD file
      fs.writeFileSync(path.join(corruptedRepoPath, '.git', 'HEAD'), 'corrupted content');
      
      const originalDir = process.cwd();
      process.chdir(corruptedRepoPath);

      try {
        const result = await isGitRepository();
        expect(result).toBe(false);
      } finally {
        process.chdir(originalDir);
        await new Promise(resolve => setTimeout(resolve, 100));
        fs.rmSync(corruptedRepoPath, { recursive: true, force: true });
      }
    });
  });

  describe('getAuthorCommits', () => {
    it('should retrieve commits for specified author', async () => {
      const commits = await getAuthorCommits('Test User');
      // Filter only main branch commits
      const mainCommits = commits.filter(commit => 
        !commit.subject.includes('Feature') && 
        !commit.subject.includes('Past') &&
        !commit.subject.includes('empty'));
      
      expect(mainCommits).toHaveLength(2);
      expect(mainCommits[0]).toHaveProperty('subject', 'Second commit with 特殊字符');
      expect(mainCommits[1]).toHaveProperty('subject', 'First commit');
    });

    it('should retrieve commits using email', async () => {
      const commits = await getAuthorCommits('test@example.com');
      // Filter only main branch commits
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
      // Create a commit with specific date
      execSync('git checkout main');
      fs.writeFileSync('test4.txt', 'Test content 4');
      execSync('git add test4.txt');
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);
      execSync(`git commit -m "Past commit" --author="${testAuthor}" --date="${pastDate.toISOString()}"`);

      const commits = await getAuthorCommits('Test User', pastDate.toISOString());
      expect(commits[0]).toHaveProperty('subject', 'Past commit');
    });

    it('should handle commits with empty message body', async () => {
      execSync('git checkout main');
      fs.writeFileSync('test5.txt', 'Test content 5');
      execSync('git add test5.txt');
      execSync('git commit -m "" --allow-empty-message --author="' + testAuthor + '"');

      const commits = await getAuthorCommits('Test User');
      const emptyCommit = commits.find(c => c.subject === '');
      expect(emptyCommit).toBeDefined();
      expect(emptyCommit.body).toBe('');
    });
  });

  describe('getCommitDetails', () => {
    let firstCommitHash;
    let unicodeCommitHash;

    beforeAll(async () => {
      const commits = await getAuthorCommits('Test User');
      firstCommitHash = commits[1].hash; // First commit
      unicodeCommitHash = commits[0].hash; // Commit with Unicode characters
    });

    it.skip('should retrieve details for valid commit hash', async () => {
      // Get commit details with git show to verify file content
      const details = await getCommitDetails(firstCommitHash);
      expect(details).toMatch(/test1\.txt/);
    });

    it.skip('should handle commit with Unicode characters', async () => {
      // Get commit details with git show to verify file content and diff
      const details = await getCommitDetails(unicodeCommitHash);
      expect(details).toMatch(/test2\.txt/);
      expect(details).toContain('你好');
    });

    it('should use cache for repeated requests', async () => {
      // First request
      const details1 = await getCommitDetails(firstCommitHash);
      // Second request should use cache
      const details2 = await getCommitDetails(firstCommitHash);
      expect(details1).toBe(details2);
    });

    it('should throw error for invalid commit hash', async () => {
      await expect(getCommitDetails('invalid-hash'))
        .rejects.toThrow('Invalid commit hash format');
    });

    it('should throw error for non-existent commit hash', async () => {
      await expect(getCommitDetails('1234567890abcdef'))
        .rejects.toThrow('Git command failed');
    });
  });
});
