# gitlog-author

[![npm version](https://img.shields.io/npm/v/gitlog-author.svg)](https://www.npmjs.com/package/gitlog-author)
[![npm downloads](https://img.shields.io/npm/dm/gitlog-author.svg)](https://www.npmjs.com/package/gitlog-author)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node Version](https://img.shields.io/node/v/gitlog-author)](https://nodejs.org)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/bayuagpr/gitlog-author/pulls)

A powerful CLI tool to generate rich, author-focused Git commit logs with metrics and trends in Markdown format.

⚠️ **IMPORTANT DISCLAIMER**
Before using this tool with AI services, any third party services or sharing logs, please be aware that:
- By default, this tool NEVER shows code diffs for security and performance reasons
- Code diffs are ONLY shown when explicitly requested with `--review` flag
- You're responsible for any sensitive data exposure
- If you work with confidential code, ensure you have permission to share commit logs and diffs

## Table of Contents
- [Background](#background)
- [Why Use Git Author Log Generator](#why-use-git-author-log-generator)
- [Features](#features)
- [How It Works](#how-it-works)
- [Installation](#installation)
- [Usage](#usage)
- [Output](#output)
- [Requirements](#requirements)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License](#license)

## Background

Managing and tracking contributions in Git repositories can be challenging, especially in large projects with multiple contributors. Traditional Git logs can be overwhelming and difficult to parse when you need to focus on specific authors' contributions.

## Why Use Git Author Log Generator?

### For Developers
- Preparing for performance reviews by showcasing your contributions
- Building a portfolio of work examples for job interviews
- Tracking your productivity and work patterns
- Creating documentation for your handover when switching teams

### For Team Leads
- Generating sprint review reports of team contributions
- Tracking team member productivity and work distribution
- Creating audit trails for compliance requirements
- Documenting team member impact for promotions

### For Project Managers
- Generating release notes and changelogs by contributor
- Creating handover documentation when team members transition
- Tracking project history and evolution
- Monitoring contribution patterns across teams

### For Organizations
- Maintaining compliance audit trails
- Tracking intellectual property contributions
- Creating documentation for knowledge retention
- Supporting performance evaluation processes

## The Power of Good Commit Messages

Ever wondered why senior developers insist on meaningful commit messages? This tool showcases exactly why - well-structured commit histories become invaluable for career growth, team collaboration, and project maintenance. Your future self (or your team) will thank you for those detailed commit messages when preparing for interviews or tracking down changes months later.

## Features

- Filter commits by author name or email
- Date range filtering with `--since` and `--until`
- Detailed commit information including descriptions and file changes
- Output in clean Markdown format
- Smart author name matching with `--verify` option
- List all repository authors with `--list-authors`
- Skip remote fetching with `--skip-fetch`
- Optional productivity metrics (can be disabled with `--no-metrics`)
- Trend analysis with `--trend=<period>`:
  - Daily trends (last 7 days)
  - Weekly trends (last 4 weeks)
  - Monthly trends (last 6 months)
  - Time distribution (morning/afternoon/evening)
  - Commit type categorization
  - File and directory impact analysis
- Code review functionality with `--review`:
  - Detailed code review reports with risk assessment
- Safety features:
  - No diff content included
  - Sanitized filenames
  - UTF-8 encoding
  - Git command validation

## How It Works

This tool operates through several key steps:

1. Repository Validation & Setup
   - Verifies if current directory is a git repository
   - Optionally fetches latest changes (unless `--skip-fetch` used)
   - Creates output directory for logs

2. Author Processing
   - Smart author matching:
     - Exact name/email match
     - Case-insensitive search
     - Partial name/email matching with `--verify`
   - Lists all authors with commit counts via `--list-authors`

3. Data Collection
   - Fetches commits by author within specified date range
   - Processes commit metadata (messages, timestamps, hashes)
   - Collects file change information (filenames only, no content)
   - Caches commit details for performance

4. Analysis & Metrics (when `--no-metrics` not used)
   - Calculates code velocity metrics
   - Analyzes time-of-day patterns
   - Tracks directory impact
   - Identifies most modified files
   - Categorizes commit types

5. Trend Analysis (with `--trend`)
   - Generates period-based reports (daily/weekly/monthly)
   - Calculates rolling trends
   - Aggregates commit patterns
   - Shows time distribution
   - Identifies peak activity periods

6. Code Review (with `--review`)
   - Generate code review report with code diffs
   - Provide checklists for code review
   - Performs risk assessment on changes
   - Memory-efficient streaming for large diffs

7. Output Generation
   - Creates timestamped Markdown files
   - Sanitizes all output content
   - Handles UTF-8 encoding
   - Formats data for readability
   - Includes metadata and summaries

Safety Measures:
- No code diffs included by default
- File paths sanitized
- Git commands validated
- Error handling for invalid inputs
- Memory-efficient batch processing

The tool runs entirely locally using Git commands. No data is sent to external services. However, be cautious when sharing generated logs as they may contain sensitive information from commit messages, code diffs, or file paths.

## Installation

```bash
# Option 1: Use directly with npx
npx gitlog-author "John Doe"

# Option 2: Install globally via npm
npm install -g gitlog-author

# Option 3: Clone and install locally
git clone https://github.com/bayuagpr/gitlog-author.git
cd gitlog-author
npm install -g .
```

## Usage

```bash
npx gitlog-author <author> [--since=<date>] [--until=<date>] [--verify] [--no-metrics] [--trend=<period>] [--review] [--include-dirs=<dirs>] [--exclude-dirs=<dirs>]
```

### Arguments

- `author`: Author name or email to filter commits by
- `--since`: Show commits more recent than a specific date (optional)
- `--until`: Show commits older than a specific date (optional)
- `--verify`: Verify author existence and show matching authors
- `--list-authors`: Show all authors in the repository
- `--skip-fetch`: Skip fetching latest changes from remote
- `--no-metrics`: Skip productivity metrics calculation
- `--trend=<period>`: Generate contribution trend report (daily, weekly, or monthly)
- `--review`: Generate detailed code review report with risk assessment
- `--include-dirs=<dirs>`: Only include commits affecting these directories (comma-separated)
- `--exclude-dirs=<dirs>`: Exclude commits affecting these directories (comma-separated)
- `--help`, `-h`: Show help message

### Examples

```bash
# Basic usage with author name
npx gitlog-author "John Doe"

# Using email address
npx gitlog-author "john@example.com"

# With date range
npx gitlog-author "John Doe" --since="1 week ago" --until="today"

# Using ISO dates
npx gitlog-author "John Doe" --since="2023-01-01" --until="2023-12-31"

# Skip fetching latest changes from remote
npx gitlog-author "John Doe" --skip-fetch

# Skip metrics calculation
npx gitlog-author "John Doe" --no-metrics

# Verify author existence
npx gitlog-author "John" --verify

# List all authors
npx gitlog-author --list-authors

# Generate trend reports
npx gitlog-author "John Doe" --trend=daily    # Show last 7 days trends
npx gitlog-author "John Doe" --trend=daily --since="2023-01-01" --until="2023-12-31"    

# Show based on date range
npx gitlog-author "John Doe" --trend=weekly   # Show last 4 weeks trends
npx gitlog-author "John Doe" --trend=monthly  # Show last 6 months trends

# Filter by directories
npx gitlog-author "John Doe" --include-dirs="src,tests"  # Only include src and tests directories
npx gitlog-author "John Doe" --trend=monthly --exclude-dirs="core/backend,core/shared"  # Exclude some directories and show last 6 months trends

# Code review functionality
npx gitlog-author "John Doe" --review  # Generate detailed code review report
npx gitlog-author "John Doe" --review --since="1 week ago"  # Review code changes from the last week
```

### Date Formats

Supports various date formats:
- ISO 8601 (e.g., "2023-01-01")
- Relative dates (e.g., "1 week ago", "yesterday")
- Named dates (e.g., "last monday", "last month")

### Directory Filtering Format

The `--include-dirs` and `--exclude-dirs` options accept comma-separated lists of directory paths:

- Paths are relative to repository root
- No spaces between commas
- Cannot use both include and exclude at the same time
- Automatically excludes common patterns like:
  - `node_modules/`
  - `dist/`
  - `build/`
  - `.nx/`
  - `coverage/`
  - `.next/`
  - `.cache/`
  - `package-lock.json`
  - `yarn.lock`
  - Minified files (`.min.js`, `.min.css`)
  - Source maps (`.map`)
  - TypeScript declaration files (`.d.ts`)

Examples:
```bash
# Only include src and tests directories
npx gitlog-author "John Doe" --include-dirs="src,tests"

# Exclude core backend and shared code
npx gitlog-author "John Doe" --exclude-dirs="core/backend,core/shared"

# Include src directory with trend analysis
npx gitlog-author "John Doe" --trend=monthly --include-dirs="src"
```

## Output

The script generates the following Markdown files in the `git-logs` directory:

### 1. Commit Log File (`<author>_commits_<timestamp>.md`)
Generated by default unless using `--verify`, `--list-authors`, `--review` or `--trend`:
- Commit messages and descriptions
- Timestamps
- File changes (without content diffs)
- Commit hashes

### 2. Metrics File (`<author>_metrics_<timestamp>.md`) 
Generated by default unless using `--no-metrics`, `--review` or `--trend`:
- Code Velocity
  - Total lines changed
  - Average changes per commit
  - Commit frequency (commits per day)
- Time Distribution (24-hour format)
  - Morning (5:00-11:59)
  - Afternoon (12:00-16:59)
  - Evening (17:00-4:59)
- Impact Analysis
  - Most modified source files
  - Directory impact breakdown
  - Commit type analysis

### 3. Trend File (`<author>_<period>_trend_<timestamp>.md`)
Generated with `--trend=<period>`:
- Overview section with:
  - Total commits in period
  - Most active day/week/month
  - Primary contribution type
- Detailed breakdown by period showing:
  - Commit count
  - Time distribution
  - Commit types and counts

### 4. Review File (`<author>_review_<timestamp>.md`)
Generated with `--review`:
- Risk Assessment:
  - High-impact modifications
  - Security considerations
  - Breaking changes
- Code Analysis:
  - Detailed commit diffs
  - Directory-specific filtering
  - Provide checklists for code review
- Change Patterns:
  - Commit history within specified date range
  - File modifications tracking

All files include:
- Generation timestamp
- Date range (if specified)
- Directory filters (if specified)
- UTF-8 encoding
- Sanitized filenames

## Output Example
You can check the output example (commit log version) in the [output-example/output-example.md](/output-example/output-example.md) file

## Requirements

- Node.js 14.x or higher
- Git installed and accessible from command line
- Must be run from within a git repository 

## Troubleshooting

### Common Issues

1. **Git Not Found**
   - Ensure Git is installed and accessible from command line
   - Add Git to your system PATH
   - Try running `git --version` to verify installation

2. **Permission Denied**
   - Check if you have read access to the Git repository
   - Ensure you have write permissions in the output directory
   - Run with appropriate permissions/sudo if needed

3. **No Commits Found**
   - Verify author name/email is correct
   - Check if repository has any commits
   - Ensure date range (if specified) is valid
   - Try using different name formats (e.g., "John Doe" vs "john@example.com")

4. **Invalid Date Format**
   - Use supported date formats (ISO 8601, relative dates, named dates)
   - Check date string syntax
   - Avoid special characters in date strings

5. **Memory Issues**
   - Try processing smaller date ranges
   - Close other memory-intensive applications
   - Consider increasing Node.js memory limit

For more issues, please check the [Issues](https://github.com/bayuagpr/gitlog-author/issues) section.

## Contributing

We welcome contributions! Here's how you can help:

1. **Fork the Repository**
   ```bash
   git clone https://github.com/bayuagpr/gitlog-author.git
   cd gitlog-author
   npm install
   ```

2. **Create a Branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

3. **Make Changes**
   - Write clean, documented code
   - Follow existing code style
   - Add tests for new features
   - Update documentation as needed

4. **Run Tests**
   ```bash
   npm test
   ```

5. **Submit PR**
   - Create detailed PR description
   - Reference any related issues
   - Wait for review and address feedback

### Development Guidelines

- Use meaningful commit messages
- Write tests for new features
- Document code changes
- Follow semantic versioning
- Keep PRs focused and atomic

## License

MIT License

Copyright (c) 2025 by Bayu Prakoso (bayuagpr/bayuagprx)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
