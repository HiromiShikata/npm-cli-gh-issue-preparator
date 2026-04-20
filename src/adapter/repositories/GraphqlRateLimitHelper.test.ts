import { defaultSleep, isRateLimitError } from './GraphqlRateLimitHelper';

describe('isRateLimitError', () => {
  it('should return true when error has RATE_LIMIT type', () => {
    expect(
      isRateLimitError([{ type: 'RATE_LIMIT', message: 'some error' }]),
    ).toBe(true);
  });

  it('should return true when error has graphql_rate_limit code', () => {
    expect(
      isRateLimitError([{ code: 'graphql_rate_limit', message: 'some error' }]),
    ).toBe(true);
  });

  it('should return true when message contains rate limit string', () => {
    expect(
      isRateLimitError([
        { message: 'API rate limit already exceeded for user.' },
      ]),
    ).toBe(true);
  });

  it('should return true when message contains rate limit string case insensitively', () => {
    expect(isRateLimitError([{ message: 'Rate Limit exceeded' }])).toBe(true);
  });

  it('should return false when error has unrelated message', () => {
    expect(isRateLimitError([{ message: 'Field not found' }])).toBe(false);
  });

  it('should return false when message is not a string', () => {
    expect(isRateLimitError([{ message: 42 }])).toBe(false);
  });

  it('should return false when message is undefined', () => {
    expect(isRateLimitError([{}])).toBe(false);
  });

  it('should return false for empty array', () => {
    expect(isRateLimitError([])).toBe(false);
  });

  it('should return true when any error in array is a rate limit error', () => {
    expect(
      isRateLimitError([
        { message: 'Field not found' },
        { type: 'RATE_LIMIT', message: 'rate limited' },
      ]),
    ).toBe(true);
  });
});

describe('defaultSleep', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should resolve after the specified duration', async () => {
    let resolved = false;
    const promise = defaultSleep(1000).then(() => {
      resolved = true;
    });
    jest.advanceTimersByTime(1000);
    await promise;
    expect(resolved).toBe(true);
  });

  it('should not resolve before the specified duration', async () => {
    let resolved = false;
    const promise = defaultSleep(1000).then(() => {
      resolved = true;
    });
    jest.advanceTimersByTime(999);
    await Promise.resolve();
    expect(resolved).toBe(false);
    jest.advanceTimersByTime(1);
    await promise;
    expect(resolved).toBe(true);
  });
});
