# Git Author Log Generator

CLI tool to generate detailed Markdown logs of git commits by author.

⚠️ **IMPORTANT DISCLAIMER**
Before using this tool with AI services, any third party services or sharing logs, please be aware that:
- No automatic filtering of secrets/credentials in this tool
- You're responsible for any sensitive data exposure
- Tool only shows changed files (no diffs) to minimize security risks
- We are NOT responsible for any NDA violations or confidentiality breaches
- If you work with confidential code, ensure you have permission to share commit logs

## Background

Managing and tracking contributions in Git repositories can be challenging, especially in large projects with multiple contributors. Traditional Git logs can be overwhelming and difficult to parse when you need to focus on specific authors' contributions.

## Why Use Git Author Log Generator?

- **Contribution Tracking**: Easily generate reports of team members' work for standups, reviews, or documentation
- **Audit Trail**: Create clean, readable logs for compliance or tracking project history
- **Performance Reviews**: Generate detailed contribution logs for developer evaluations
- **Documentation**: Automatically document changes by specific authors for release notes or changelogs
- **Time Tracking**: Review work patterns and contribution timelines with date filtering
- **AI-Enhanced Interview Prep**: Feed your contribution logs to AI tools to help prepare compelling examples of your work for interviews

## The Power of Good Commit Messages

Ever wondered why senior developers insist on meaningful commit messages? This tool showcases exactly why - well-structured commit histories become invaluable for career growth, team collaboration, and project maintenance. Your future self (or your team) will thank you for those detailed commit messages when preparing for interviews or tracking down changes months later.

## Features

- Filter commits by author name or email
- Date range filtering with `--since` and `--until`
- Detailed commit information including descriptions and file changes
- Output in clean Markdown format
- Handles special characters and emoji in commit messages
- Smart author name matching
- AI friendly output (also depend on how much commits you have because it will impact the context window of the AI)

## How It Works

This tool:
1. Executes git commands to fetch commits by author
2. Uses smart author matching to find commits by:
   - Exact name/email match
   - Flexible name spacing
   - Case-insensitive fuzzy matching
3. Processes commits in batches to manage memory
4. Caches commit details using LRU (Least Recently Used) cache
5. Generates Markdown files with:
   - Commit messages and timestamps
   - File changes (without content diffs)
   - Commit hashes and descriptions
6. Implements safety measures:
   - Sanitizes output to prevent injection
   - Validates git commands
   - Handles special characters and emoji
   - Uses UTF-8 encoding

This tool operates locally using Git commands and does not send any data to third parties. However, if you use the generated logs with AI tools or any third party services:

- You are responsible for reviewing the logs for sensitive information before sharing them with any AI tools or services
- You are aware that this git log author generator tool cannot detect or filter out secrets, credentials, or confidential information that may exist in your commit history
- You should always verify the content of generated logs before uploading them to external services 

The reason we don't include the diffs other than the file will be too large and will be inefficient to generate the diffs, we wan't to make minimize the possibility of exposing any sensitive information from your commit history.

## Installation

```bash
# Clone the repository
git clone [your-repo-url]

cd gitlog-authormd

# Install script globally
npm install -g .
```

## Usage

```bash
gitlog-author <author> [--since=<date>] [--until=<date>]
```

### Arguments

- `author`: Author name or email to filter commits by
- `--since`: Show commits more recent than a specific date (optional)
- `--until`: Show commits older than a specific date (optional)
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
```

### Date Formats

Supports various date formats:
- ISO 8601 (e.g., "2023-01-01")
- Relative dates (e.g., "1 week ago", "yesterday")
- Named dates (e.g., "last monday", "last month")

## Output

The script creates a Markdown file in the `git-logs` directory with:
- Commit messages and descriptions
- Timestamps
- File changes
- Commit hashes
- Full commit details (without the details of the diffs, only what files were changed)

## Output Example
You can check the output example in the [output-example.md](output-example.md) file

## Requirements

- Node.js 12.x or higher
- Git installed and accessible from command line
- Must be run from within a git repository 