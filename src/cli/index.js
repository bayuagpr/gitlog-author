#!/usr/bin/env node

/**
 * @module cli
 * @description Command-line interface for generating git contribution reports and metrics
 */

const { colors } = require('../constants');
const { fetchLatestChanges } = require('../services/gitOperations');
const AuthorCommand = require('./commands/AuthorCommand');
const TrendCommand = require('./commands/TrendCommand');
const ListCommand = require('./commands/ListCommand');
const VerifyCommand = require('./commands/VerifyCommand');
const ReviewCommand = require('./commands/ReviewCommand');
const GitLogError = require('../models/GitLogError');

/**
 * Print help message
 */
function printHelp() {
  console.log(`
${colors.bright}Generate Git Log by Author${colors.reset}

Usage: gitlog-author <author> [--since=<date>] [--until=<date>] [--verify] [--no-metrics] [--trend=<period>] [--review] [--create-branch] [--branch-name=<name>] [--base-commit=<hash>] [--no-cleanup] [--include-dirs=<dirs>] [--exclude-dirs=<dirs>]

Arguments:
  author         Author name or email to filter commits by

Options:
  --since=<date> Show commits more recent than a specific date
  --until=<date> Show commits older than a specific date
  --verify       Verify author existence and show matching authors
  --list-authors Show all authors in the repository
  --skip-fetch   Skip fetching latest changes from remote
  --no-metrics   Skip productivity metrics calculation
  --trend=<period> Generate contribution trend report (daily, weekly, or monthly)
  --review       Generate detailed code review report with risk assessment
  --create-branch Create a temporary branch for accumulated review changes
  --branch-name=<name> Custom name for review branch (default: review/author/timestamp)
  --base-commit=<hash> Base commit to compare changes against (default: first commit's parent)
  --no-cleanup   Keep the review branch after generating report (default: cleanup)
  --include-dirs=<dirs> Only include commits affecting these directories (comma-separated)
  --exclude-dirs=<dirs> Exclude commits affecting these directories (comma-separated)
  --help, -h     Show this help message

Examples:
  gitlog-author "John Doe" # Show commits by John Doe
  gitlog-author "john@example.com" --since="1 week ago" # Show commits by john@example.com in the last week
  gitlog-author "John Doe" --since="2023-01-01" --until="2023-12-31" # Show commits by John Doe in the year 2023
  gitlog-author "John Doe" --skip-fetch # Skip fetching latest changes from remote
  gitlog-author "John Doe" --no-metrics # Skip productivity metrics calculation

  gitlog-author "John" --verify # Verify author existence and show matching authors
  gitlog-author --list-authors # Show all authors in the repository

  gitlog-author "John Doe" --trend=daily    # Show last 7 days trends
  gitlog-author "John Doe" --trend=daily --since="2023-01-01" --until="2023-12-31"    # Show based on date range
  gitlog-author "John Doe" --trend=weekly   # Show last 4 weeks trends
  gitlog-author "John Doe" --trend=monthly  # Show last 6 months trends
  gitlog-author "John Doe" --include-dirs="src,tests"  # Only src and tests directories and show commits and metrics for those directories
  gitlog-author "John Doe" --trend=monthly --exclude-dirs="core/backend,core/shared"  # Exclude some directories and show last 6 months trends
  gitlog-author "John Doe" --review  # Generate detailed code review report with risk assessment
  gitlog-author "John Doe" --review --since="1 week ago"  # Review code changes from the last week

  `);
}

/**
 * Main CLI entry point
 * @async
 * @returns {Promise<void>}
 */
async function main() {
  try {
    const args = process.argv.slice(2);
    
    if (args.includes('--help') || args.includes('-h') || args.length === 0) {
      printHelp();
      return;
    }

    if (!args.includes('--skip-fetch')) {
      console.log(`${colors.blue}Fetching latest changes...${colors.reset}`);
      await fetchLatestChanges();
    }

    let command;
    if (args.includes('--list-authors')) {
      command = new ListCommand(args);
    } else if (args.includes('--verify')) {
      command = new VerifyCommand(args);
    } else if (args.find(arg => arg.startsWith('--trend='))) {
      command = new TrendCommand(args);
    } else if (args.includes('--review')) {
      command = new ReviewCommand(args);
    } else {
      command = new AuthorCommand(args);
    }

    command.validateArgs();
    await command.execute();
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
