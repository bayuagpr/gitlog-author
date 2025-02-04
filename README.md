# Git Author Log Generator

CLI tool to generate detailed Markdown logs of git commits by author.

## Features

- Filter commits by author name or email
- Date range filtering with `--since` and `--until`
- Detailed commit information including descriptions and file changes
- Output in clean Markdown format
- Handles special characters and emoji in commit messages
- Smart author name matching

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
- Full commit details

## Requirements

- Node.js 12.x or higher
- Git installed and accessible from command line
- Must be run from within a git repository 