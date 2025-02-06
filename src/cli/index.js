#!/usr/bin/env node

const path = require('path');
const { colors } = require('../constants');
const { isGitRepository, fetchLatestChanges } = require('../services/gitOperations');
const { getAllAuthors, getAuthorCommits, getCommitDetails } = require('../services/authorService');
const { calculateVelocityMetrics } = require('../services/metricsService');
const { sanitizeFilename, createWriteStream } = require('../utils/fileUtils');
const GitLogError = require('../models/GitLogError');

async function generateAuthorLog(author, since = '', until = '') {
  try {
    if (!await isGitRepository()) {
      throw new GitLogError(
        'Not a git repository. Please run this command from within a git repository.',
        'NOT_GIT_REPO'
      );
    }

    console.log(`${colors.blue}Fetching commits for author: ${colors.bright}${author}${colors.reset}`);
    
    const commits = await getAuthorCommits(author, since, until);
    console.log(`${colors.green}✓ Found ${colors.bright}${commits.length}${colors.reset}${colors.green} commits${colors.reset}`);
    
    if (!commits.length) {
      console.log(`${colors.yellow}No commits found for author: ${author}${colors.reset}`);
      return;
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outputDir = path.join(process.cwd(), 'git-logs');
    
    const commitsFile = path.join(outputDir, `${sanitizeFilename(author)}_commits_${timestamp}.md`);
    const commitsStream = createWriteStream(commitsFile);

    // Write header for commits file
    commitsStream.write(`# Git Log for ${author}\n\n`);
    commitsStream.write(`Generated on: ${new Date().toLocaleString('en-US', { timeZoneName: 'short' })}\n\n`);
    
    if (since || until) {
      commitsStream.write('## Date Range\n');
      if (since) commitsStream.write(`From: ${since}\n`);
      if (until) commitsStream.write(`To: ${until}\n`);
      commitsStream.write('\n');
    }

    // Calculate and write productivity metrics if not disabled
    let metricsFile;
    if (!process.argv.includes('--no-metrics')) {
      console.log(`${colors.blue}Calculating productivity metrics...${colors.reset}`);
      const metrics = await calculateVelocityMetrics(commits);
      
      metricsFile = path.join(outputDir, `${sanitizeFilename(author)}_metrics_${timestamp}.md`);
      const metricsStream = createWriteStream(metricsFile);
      
      metricsStream.write(`# Productivity Metrics for ${author}\n\n`);
      metricsStream.write(`Generated on: ${new Date().toLocaleString('en-US', { timeZoneName: 'short' })}\n\n`);
      
      if (since || until) {
        metricsStream.write('## Date Range\n');
        if (since) metricsStream.write(`From: ${since}\n`);
        if (until) metricsStream.write(`To: ${until}\n`);
        metricsStream.write('\n');
      }
      
      metricsStream.write('## Code Velocity\n\n');
      metricsStream.write(`- **Total Lines Changed:** ${metrics.totalLinesChanged.toLocaleString()}\n`);
      metricsStream.write(`- **Average Changes per Commit:** ${metrics.averageCommitSize.toLocaleString()} lines\n`);
      metricsStream.write(`- **Commit Frequency:** ${metrics.commitsPerDay} commits per day\n`);
      metricsStream.write('\n**Time Distribution:**\n');
      metricsStream.write(`- Morning (5:00-11:59): ${metrics.timeDistribution.morning}%\n`);
      metricsStream.write(`- Afternoon (12:00-16:59): ${metrics.timeDistribution.afternoon}%\n`);
      metricsStream.write(`- Evening (17:00-4:59): ${metrics.timeDistribution.evening}%\n`);
      
      metricsStream.write('\n## Impact Analysis\n\n');
      metricsStream.write('**Most Modified Source Files:**\n');
      if (metrics.impactMetrics.topFiles.length > 0) {
        metrics.impactMetrics.topFiles.forEach(({ file, changes }) => {
          metricsStream.write(`- \`${file}\`: ${changes.toLocaleString()} changes\n`);
        });
      } else {
        metricsStream.write('No source code changes found\n');
      }
      
      metricsStream.write('\n**Directory Impact:**\n');
      
      // Helper function to write directory tree
      function writeDirectoryTree(group, level = 0) {
        const indent = '  '.repeat(level);
        Array.from(group.entries()).forEach(([dirPath, { changes, percentage, subPaths }]) => {
          const displayPath = dirPath.split('/').pop();
          if (changes > 0) {
            metricsStream.write(`${indent}- \`${displayPath}/\`: ${changes.toLocaleString()} changes (${percentage}%)\n`);
          }
          if (subPaths.size > 0) {
            writeDirectoryTree(subPaths, level + 1);
          }
        });
      }

      if (metrics.impactMetrics.groupedDirectories) {
        writeDirectoryTree(metrics.impactMetrics.groupedDirectories);
      } else {
        metrics.impactMetrics.directoryImpact.forEach(({ directory, changes, percentage }) => {
          metricsStream.write(`- \`${directory}\`: ${changes.toLocaleString()} changes (${percentage}%)\n`);
        });
      }

      metricsStream.write('\n## Commit Type Analysis\n\n');
      metricsStream.write(`**Primary Contribution Type:** ${metrics.typeMetrics.primaryContributionType}\n\n`);
      metricsStream.write('**Type Breakdown:**\n');
      metrics.typeMetrics.typeBreakdown.forEach(({ type, percentage }) => {
        metricsStream.write(`- ${type}: ${percentage}%\n`);
      });
      
      await new Promise((resolve, reject) => {
        metricsStream.end(err => {
          if (err) reject(err);
          else resolve();
        });
      });
    }

    commitsStream.write('## Commits\n\n');

    console.log(`${colors.blue}Processing commits and generating log file...${colors.reset}`);
    
    // Process commits in chunks while maintaining order
    const chunkSize = 15;
    for (let i = 0; i < commits.length; i += chunkSize) {
      const chunk = commits.slice(i, Math.min(i + chunkSize, commits.length));
      const progress = Math.min(((i + chunk.length) / commits.length) * 100, 100).toFixed(0);
      process.stdout.write(`${colors.dim}Progress: ${progress}%${colors.reset}\r`);
      
      // Process chunk in parallel but write sequentially
      const chunkResults = await Promise.all(chunk.map(async commit => {
        const commitContent = [];
        
        const escapedSubject = commit.subject.replace(/([_*`#])/g, '\\$1');
        commitContent.push(`### ${escapedSubject}\n`);
        commitContent.push(`**Date:** ${new Date(commit.date).toLocaleString('en-US', { timeZoneName: 'short' })}\n`);
        commitContent.push(`**Hash:** \`${commit.hash}\`\n\n`);

        if (commit.body.trim()) {
          const escapedBody = commit.body.trim()
            .split('\n')
            .map(line => `> ${line.replace(/([_*`#>])/g, '\\$1').trim()}`)
            .join('\n');
          commitContent.push('**Description:**\n');
          commitContent.push(escapedBody);
          commitContent.push('\n\n');
        }

         // Get commit details with caching
         const details = await getCommitDetails(commit.hash);
         if (details.trim()) {
           commitContent.push('**Changes:**\n```\n');
           commitContent.push(details.trim());
           commitContent.push('\n```\n\n');
         }

        commitContent.push('---\n\n');
        return commitContent.join('');
      }));

      // Write chunk results sequentially
      for (const content of chunkResults) {
        commitsStream.write(content);
      }
    }

    // Close the commits stream properly
    await new Promise((resolve, reject) => {
      commitsStream.end(err => {
        if (err) reject(err);
        else resolve();
      });
    });

    process.stdout.write('\n');
    console.log(`${colors.green}✓ Generated commits file: ${colors.reset}${commitsFile}`);
    if (metricsFile) {
      console.log(`${colors.green}✓ Generated metrics file: ${colors.reset}${metricsFile}`);
    }
    
    return { commitsFile, metricsFile };
  } catch (error) {
    if (error instanceof GitLogError) {
      throw error;
    }
    throw new GitLogError(
      'Error generating author log: ' + error.message,
      'GIT_OPERATION_FAILED',
      { error: error.message }
    );
  }
}

async function main() {
  try {
    const args = process.argv.slice(2);
    
    if (args.includes('--help') || args.includes('-h') || args.length === 0) {
      console.log(`
${colors.bright}Generate Git Log by Author${colors.reset}

Usage: gitlog-author <author> [--since=<date>] [--until=<date>] [--verify] [--no-metrics]

Arguments:
  author         Author name or email to filter commits by

Options:
  --since=<date> Show commits more recent than a specific date
  --until=<date> Show commits older than a specific date
  --verify       Verify author existence and show matching authors
  --list-authors Show all authors in the repository
  --skip-fetch   Skip fetching latest changes from remote
  --no-metrics   Skip productivity metrics calculation
  --help, -h     Show this help message

Examples:
  gitlog-author "John Doe"
  gitlog-author "john@example.com" --since="1 week ago"
  gitlog-author "John Doe" --since="2023-01-01" --until="2023-12-31"
  gitlog-author "John" --verify
  gitlog-author --list-authors
      `);
      return;
    }

    if (!args.includes('--skip-fetch')) {
      console.log(`${colors.blue}Fetching latest changes...${colors.reset}`);
      await fetchLatestChanges();
    }

    if (args.includes('--list-authors')) {
      if (!await isGitRepository()) {
        throw new GitLogError(
          'Not a git repository. Please run this command from within a git repository.',
          'NOT_GIT_REPO'
        );
      }

      console.log(`${colors.blue}Fetching all authors...${colors.reset}`);
      const authors = await getAllAuthors();
      
      if (!authors.length) {
        console.log(`${colors.yellow}No commits found in this repository${colors.reset}`);
        return;
      }

      console.log(`\n${colors.bright}Authors in this repository:${colors.reset}\n`);
      authors.forEach(author => {
        console.log(`${colors.green}${author.commits.toString().padStart(4)}${colors.reset} ${author.name} <${author.email}>`);
      });
      console.log(`\n${colors.bright}Total authors: ${authors.length}${colors.reset}`);
      return;
    }

    if (args.includes('--verify')) {
      if (!await isGitRepository()) {
        throw new GitLogError(
          'Not a git repository. Please run this command from within a git repository.',
          'NOT_GIT_REPO'
        );
      }

      const authorQuery = args[0];
      if (!authorQuery) {
        throw new GitLogError(
          'Author name or email is required with --verify',
          'INVALID_AUTHOR'
        );
      }

      console.log(`${colors.blue}Verifying author: ${colors.bright}${authorQuery}${colors.reset}`);
      const authors = await getAllAuthors();
      
      if (!authors.length) {
        console.log(`${colors.yellow}No commits found in this repository${colors.reset}`);
        return;
      }

      const matchingAuthors = authors.filter(author => {
        const searchStr = authorQuery.toLowerCase();
        return author.name.toLowerCase().includes(searchStr) || 
               author.email.toLowerCase().includes(searchStr);
      });

      if (matchingAuthors.length === 0) {
        console.log(`${colors.yellow}No matching authors found for: ${authorQuery}${colors.reset}`);
        return;
      }

      console.log(`\n${colors.bright}Matching authors:${colors.reset}\n`);
      for (const author of matchingAuthors) {
        console.log(`${colors.green}✓${colors.reset} ${author.name} <${author.email}> (${colors.bright}${author.commits}${colors.reset} commits)`);
      }

      const sinceArg = args.find(arg => arg.startsWith('--since='));
      const untilArg = args.find(arg => arg.startsWith('--until='));
      const since = sinceArg ? sinceArg.split('=')[1] : '';
      const until = untilArg ? untilArg.split('=')[1] : '';

      if (since || until) {
        console.log(`\n${colors.bright}Date range verification:${colors.reset}`);
        if (since) console.log(`From: ${since}`);
        if (until) console.log(`To: ${until}`);
        console.log('');

        for (const author of matchingAuthors) {
          process.stdout.write(`${colors.dim}Checking commits for ${author.name}...${colors.reset}\r`);
          const commits = await getAuthorCommits(author.name, since, until);
          if (commits.length > 0) {
            console.log(`${colors.green}✓${colors.reset} ${author.name}: ${colors.bright}${commits.length}${colors.reset} commits in this period`);
          } else {
            console.log(`${colors.yellow}○${colors.reset} ${author.name}: No commits in this period`);
          }
        }
      }

      const totalCommits = matchingAuthors.reduce((sum, author) => sum + author.commits, 0);
      console.log(`\n${colors.bright}Total commits by matching authors: ${colors.reset}${totalCommits}`);

      return;
    }

    const author = args[0];
    const sinceArg = args.find(arg => arg.startsWith('--since='));
    const untilArg = args.find(arg => arg.startsWith('--until='));

    const since = sinceArg ? sinceArg.split('=')[1] : '';
    const until = untilArg ? untilArg.split('=')[1] : '';

    await generateAuthorLog(author, since, until);
  } catch (error) {
    if (error instanceof GitLogError) {
      console.error(`${colors.red}Error: ${error.message}${colors.reset}`);
    } else {
      console.error(`${colors.red}Unexpected error: ${error.message}${colors.reset}`);
    }
    process.exit(1);
  }
}

main(); 