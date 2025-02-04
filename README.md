# Git Author Log Generator

CLI tool to generate detailed Markdown logs of git commits by author.

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

The reason we don't include the diffs is that the file would be too large and it would be inefficient to generate the diffs. We want to minimize the possibility of exposing any sensitive information from your commit history.

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