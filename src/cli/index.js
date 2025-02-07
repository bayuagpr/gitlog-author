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
const GitLogError = require('../models/GitLogError');

/**
 * Print help message
 */
function printHelp() {
  console.log(`
${colors.bright}Generate Git Log by Author${colors.reset}

Usage: gitlog-author <author> [--since=<date>] [--until=<date>] [--verify] [--no-metrics] [--trend=<period>] [--include-dirs=<dirs>] [--exclude-dirs=<dirs>]

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
  --include-dirs=<dirs> Only include commits affecting these directories (comma-separated)
  --exclude-dirs=<dirs> Exclude commits affecting these directories (comma-separated)
  --help, -h     Show this help message

Examples:
  gitlog-author "John Doe"
  gitlog-author "john@example.com" --since="1 week ago"
  gitlog-author "John Doe" --since="2023-01-01" --until="2023-12-31"
  gitlog-author "John" --verify
  gitlog-author --list-authors
  gitlog-author "John Doe" --trend=daily    # Show last 7 days trends
  gitlog-author "John Doe" --trend=weekly   # Show last 4 weeks trends
  gitlog-author "John Doe" --trend=monthly  # Show last 6 months trends
  gitlog-author "John Doe" --include-dirs="src,tests"  # Only src and tests directories
  gitlog-author "John Doe" --exclude-dirs="node_modules,dist"  # Exclude build artifacts
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
