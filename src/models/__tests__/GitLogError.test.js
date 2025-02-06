const GitLogError = require('../GitLogError');

describe('GitLogError', () => {
  it('should create error with correct properties', () => {
    const error = new GitLogError('test message', 'TEST_CODE', { detail: 'test' });
    expect(error.message).toBe('test message');
    expect(error.name).toBe('GitLogError');
    expect(error.code).toBe('TEST_CODE');
    expect(error.details).toEqual({ detail: 'test' });
  });
});
