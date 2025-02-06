const { sanitizeFilename, isValidDateFormat } = require('../fileUtils');

describe('sanitizeFilename', () => {
  it('should replace invalid characters with hyphens', () => {
    const input = 'file/with\\invalid:chars*|?"<>';
    expect(sanitizeFilename(input)).toBe('file-with-invalid-chars');
  });

  it('should replace multiple spaces with single hyphen', () => {
    expect(sanitizeFilename('file   with   spaces')).toBe('file-with-spaces');
  });

  it('should trim leading and trailing hyphens', () => {
    expect(sanitizeFilename('---file---')).toBe('file');
  });

  it('should truncate long filenames to 255 characters', () => {
    const longName = 'a'.repeat(300);
    expect(sanitizeFilename(longName)).toHaveLength(255);
  });
});

describe('isValidDateFormat', () => {
  it('should accept ISO 8601 dates', () => {
    expect(isValidDateFormat('2023-01-01')).toBe(true);
  });

  it('should accept relative dates', () => {
    expect(isValidDateFormat('1 week ago')).toBe(true);
    expect(isValidDateFormat('yesterday')).toBe(true);
  });

  it('should accept named dates', () => {
    expect(isValidDateFormat('last monday')).toBe(true);
    expect(isValidDateFormat('last month')).toBe(true);
  });

  it('should reject empty strings', () => {
    expect(isValidDateFormat('')).toBe(false);
    expect(isValidDateFormat('  ')).toBe(false);
  });

  it('should reject shell injection attempts', () => {
    expect(isValidDateFormat('2023-01-01; rm -rf /')).toBe(false);
    expect(isValidDateFormat('2023-01-01 | echo hack')).toBe(false);
    expect(isValidDateFormat('2023-01-01 > file')).toBe(false);
    expect(isValidDateFormat('2023-01-01 & ls')).toBe(false);
    expect(isValidDateFormat('2023-01-01 $ ls')).toBe(false);
  });
}); 