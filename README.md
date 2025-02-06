# gitlog-author

A powerful CLI tool to generate rich, author-focused Git commit logs with metrics and trends in Markdown format.

⚠️ **IMPORTANT DISCLAIMER**
Before using this tool with AI services, any third party services or sharing logs, please be aware that:
- No automatic filtering of secrets/credentials in this tool

- You're responsible for any sensitive data exposure
- Tool only shows changed files (no diffs) to minimize security risks
- We are NOT responsible for any NDA violations or confidentiality breaches
- If you work with confidential code, ensure you have permission to share commit logs

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
   - Collects file change information (without content diffs)
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

6. Output Generation
   - Creates timestamped Markdown files
   - Sanitizes all output content
   - Handles UTF-8 encoding
   - Formats data for readability
   - Includes metadata and summaries

Safety Measures:
- No sensitive diff content included
- File paths sanitized
- Git commands validated
- Error handling for invalid inputs
- Memory-efficient batch processing

The tool runs entirely locally using Git commands. No data is sent to external services. However, be cautious when sharing generated logs as they may contain sensitive information from commit messages or file paths.

## Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/gitlog-authormd.git

cd gitlog-authormd

# Install script globally
npm install -g .
```

## Usage

```bash
gitlog-author <author> [--since=<date>] [--until=<date>] [--verify] [--no-metrics] [--trend=<period>]
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
- `--help`, `-h`: Show help message

### Examples

```bash
# Basic usage with author name
gitlog-author "John Doe"

# Using email address
gitlog-author "john@example.com"

# With date range
gitlog-author "John Doe" --since="1 week ago" --until="today"

# Using ISO dates
gitlog-author "John Doe" --since="2023-01-01" --until="2023-12-31"

# Verify author existence
gitlog-author "John" --verify

# List all authors
gitlog-author --list-authors

# Generate trend reports
gitlog-author "John Doe" --trend=daily    # Show last 7 days trends
gitlog-author "John Doe" --trend=weekly   # Show last 4 weeks trends
gitlog-author "John Doe" --trend=monthly  # Show last 6 months trends
```

### Date Formats

Supports various date formats:
- ISO 8601 (e.g., "2023-01-01")
- Relative dates (e.g., "1 week ago", "yesterday")
- Named dates (e.g., "last monday", "last month")

## Output

The script generates the following Markdown files in the `git-logs` directory:

### 1. Commit Log File (`<author>_commits_<timestamp>.md`)
- Commit messages and descriptions
- Timestamps
- File changes (without content diffs)
- Commit hashes

### 2. Metrics File (`<author>_metrics_<timestamp>.md`) 
Generated unless `--no-metrics` is specified:
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

### 3. Trend File (`<author>_<period>_trend_<timestamp>.md`)
Generated when using `--trend=<period>`:
- Overview section with:
  - Total commits in period
  - Most active day/week/month
  - Primary contribution type
- Detailed breakdown by period showing:
  - Commit count
  - Time distribution
  - Commit types and counts

All files include:
- Generation timestamp
- Date range (if specified)
- UTF-8 encoding
- Sanitized filenames

## Output Example
You can check the output example in the [output-example/output-example.md](/output-example/output-example.md) file

## Requirements

- Node.js 12.x or higher
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

For more issues, please check the [Issues](https://github.com/yourusername/gitlog-authormd/issues) section.

## Contributing

We welcome contributions! Here's how you can help:

1. **Fork the Repository**
   ```bash
   git clone https://github.com/yourusername/gitlog-authormd.git
   cd gitlog-authormd
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

Copyright (c) 2024 [Your Name]

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
