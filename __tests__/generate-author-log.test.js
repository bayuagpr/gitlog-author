const {
  GitLogError,
  sanitizeFilename,
  isValidDateFormat,
  LRUCache
} = require('../generate-author-log');

describe('GitLogError', () => {
  it('should create error with correct properties', () => {
    const error = new GitLogError('test message', 'TEST_CODE', { detail: 'test' });
    expect(error.message).toBe('test message');
    expect(error.name).toBe('GitLogError');
    expect(error.code).toBe('TEST_CODE');
    expect(error.details).toEqual({ detail: 'test' });
  });
});

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

describe('LRUCache', () => {
  let cache;

  beforeEach(() => {
    cache = new LRUCache(3); // Small size for testing
  });

  it('should store and retrieve values', () => {
    cache.set('key1', 'value1');
    expect(cache.get('key1')).toBe('value1');
  });

  it('should return null for non-existent keys', () => {
    expect(cache.get('nonexistent')).toBeNull();
  });

  it('should evict oldest item when cache is full', () => {
    cache.set('key1', 'value1');
    cache.set('key2', 'value2');
    cache.set('key3', 'value3');
    cache.set('key4', 'value4'); // This should evict key1

    expect(cache.get('key1')).toBeNull();
    expect(cache.get('key2')).toBe('value2');
    expect(cache.get('key3')).toBe('value3');
    expect(cache.get('key4')).toBe('value4');
  });

  it('should refresh item order on get', () => {
    cache.set('key1', 'value1');
    cache.set('key2', 'value2');
    cache.set('key3', 'value3');
    
    // Access key1, making it most recently used
    cache.get('key1');
    
    // Add new item, should evict key2 instead of key1
    cache.set('key4', 'value4');

    expect(cache.get('key1')).toBe('value1');
    expect(cache.get('key2')).toBeNull();
    expect(cache.get('key3')).toBe('value3');
    expect(cache.get('key4')).toBe('value4');
  });

  it('should update existing key without affecting capacity', () => {
    cache.set('key1', 'value1');
    cache.set('key2', 'value2');
    cache.set('key3', 'value3');
    
    // Update existing key
    cache.set('key2', 'new-value2');
    
    expect(cache.get('key1')).toBe('value1');
    expect(cache.get('key2')).toBe('new-value2');
    expect(cache.get('key3')).toBe('value3');
  });
});
