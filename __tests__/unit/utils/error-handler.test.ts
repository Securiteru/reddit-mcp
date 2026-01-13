/**
 * Unit tests for error-handler utilities
 */

import { AxiosError } from 'axios';
import {
  RedditAPIError,
  RateLimitError,
  AuthenticationError,
  NotFoundError,
  ForbiddenError,
  parseRedditError,
  retryWithBackoff,
  validateConfig,
} from '../../../src/utils/error-handler';

describe('Error Classes', () => {
  describe('RedditAPIError', () => {
    it('should create error with all properties', () => {
      const error = new RedditAPIError('Test error', 500, 'TEST_CODE', { foo: 'bar' });

      expect(error.message).toBe('Test error');
      expect(error.statusCode).toBe(500);
      expect(error.errorCode).toBe('TEST_CODE');
      expect(error.details).toEqual({ foo: 'bar' });
      expect(error.name).toBe('RedditAPIError');
    });

    it('should work with minimal properties', () => {
      const error = new RedditAPIError('Simple error');

      expect(error.message).toBe('Simple error');
      expect(error.statusCode).toBeUndefined();
      expect(error.errorCode).toBeUndefined();
    });
  });

  describe('RateLimitError', () => {
    it('should create rate limit error with retry-after', () => {
      const error = new RateLimitError('Rate limited', 60);

      expect(error.message).toBe('Rate limited');
      expect(error.retryAfter).toBe(60);
      expect(error.statusCode).toBe(429);
      expect(error.errorCode).toBe('RATE_LIMIT_EXCEEDED');
      expect(error.name).toBe('RateLimitError');
    });
  });

  describe('AuthenticationError', () => {
    it('should create authentication error', () => {
      const error = new AuthenticationError('Auth failed');

      expect(error.message).toBe('Auth failed');
      expect(error.statusCode).toBe(401);
      expect(error.errorCode).toBe('AUTHENTICATION_FAILED');
      expect(error.name).toBe('AuthenticationError');
    });
  });

  describe('NotFoundError', () => {
    it('should create not found error', () => {
      const error = new NotFoundError('Not found');

      expect(error.message).toBe('Not found');
      expect(error.statusCode).toBe(404);
      expect(error.errorCode).toBe('NOT_FOUND');
      expect(error.name).toBe('NotFoundError');
    });
  });

  describe('ForbiddenError', () => {
    it('should create forbidden error', () => {
      const error = new ForbiddenError('Forbidden');

      expect(error.message).toBe('Forbidden');
      expect(error.statusCode).toBe(403);
      expect(error.errorCode).toBe('FORBIDDEN');
      expect(error.name).toBe('ForbiddenError');
    });
  });
});

describe('parseRedditError', () => {
  it('should parse 401 error as AuthenticationError', () => {
    const axiosError = {
      response: {
        status: 401,
        data: { message: 'Invalid credentials' },
      },
      isAxiosError: true,
    } as AxiosError;

    const error = parseRedditError(axiosError);

    expect(error).toBeInstanceOf(AuthenticationError);
    expect(error.message).toBe('Invalid credentials');
    expect(error.statusCode).toBe(401);
  });

  it('should use default message for 401 without data', () => {
    const axiosError = {
      response: {
        status: 401,
        data: {},
      },
      isAxiosError: true,
    } as AxiosError;

    const error = parseRedditError(axiosError);

    expect(error).toBeInstanceOf(AuthenticationError);
    expect(error.message).toContain('Authentication failed');
  });

  it('should parse 403 error as ForbiddenError', () => {
    const axiosError = {
      response: {
        status: 403,
        data: { message: 'Access denied' },
      },
      isAxiosError: true,
    } as AxiosError;

    const error = parseRedditError(axiosError);

    expect(error).toBeInstanceOf(ForbiddenError);
    expect(error.message).toBe('Access denied');
  });

  it('should parse 404 error as NotFoundError', () => {
    const axiosError = {
      response: {
        status: 404,
        data: { message: 'Post not found' },
      },
      isAxiosError: true,
    } as AxiosError;

    const error = parseRedditError(axiosError);

    expect(error).toBeInstanceOf(NotFoundError);
    expect(error.message).toBe('Post not found');
  });

  it('should parse 429 error as RateLimitError with retry-after', () => {
    const axiosError = {
      response: {
        status: 429,
        headers: { 'retry-after': '120' },
        data: {},
      },
      isAxiosError: true,
    } as unknown as AxiosError;

    const error = parseRedditError(axiosError);

    expect(error).toBeInstanceOf(RateLimitError);
    expect((error as RateLimitError).retryAfter).toBe(120);
    expect(error.message).toContain('120 seconds');
  });

  it('should use default retry-after of 60 seconds for 429 error', () => {
    const axiosError = {
      response: {
        status: 429,
        headers: {},
        data: {},
      },
      isAxiosError: true,
    } as AxiosError;

    const error = parseRedditError(axiosError);

    expect(error).toBeInstanceOf(RateLimitError);
    expect((error as RateLimitError).retryAfter).toBe(60);
  });

  it('should parse 500 error as service unavailable', () => {
    const axiosError = {
      response: {
        status: 500,
        data: {},
      },
      isAxiosError: true,
    } as AxiosError;

    const error = parseRedditError(axiosError);

    expect(error).toBeInstanceOf(RedditAPIError);
    expect(error.statusCode).toBe(500);
    expect(error.errorCode).toBe('SERVICE_UNAVAILABLE');
    expect(error.message).toContain('unavailable');
  });

  it('should parse 503 error as service unavailable', () => {
    const axiosError = {
      response: {
        status: 503,
        data: {},
      },
      isAxiosError: true,
    } as AxiosError;

    const error = parseRedditError(axiosError);

    expect(error.errorCode).toBe('SERVICE_UNAVAILABLE');
  });

  it('should handle unknown status codes', () => {
    const axiosError = {
      response: {
        status: 418, // I'm a teapot
        data: { message: 'Custom error' },
      },
      message: 'Axios error',
      isAxiosError: true,
    } as AxiosError;

    const error = parseRedditError(axiosError);

    expect(error).toBeInstanceOf(RedditAPIError);
    expect(error.message).toBe('Custom error');
    expect(error.errorCode).toBe('UNKNOWN_ERROR');
  });

  it('should handle generic Error objects', () => {
    const genericError = new Error('Something went wrong');

    const error = parseRedditError(genericError);

    expect(error).toBeInstanceOf(RedditAPIError);
    expect(error.message).toBe('Something went wrong');
  });

  it('should handle unknown error types', () => {
    const unknownError = 'string error';

    const error = parseRedditError(unknownError);

    expect(error).toBeInstanceOf(RedditAPIError);
    expect(error.message).toBe('An unknown error occurred');
  });
});

describe('retryWithBackoff', () => {
  beforeEach(() => {
    jest.clearAllTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should succeed on first attempt', async () => {
    const mockFn = jest.fn().mockResolvedValue('success');

    const result = await retryWithBackoff(mockFn, 3);

    expect(result).toBe('success');
    expect(mockFn).toHaveBeenCalledTimes(1);
  });

  it('should retry on transient errors', async () => {
    jest.useFakeTimers();
    const mockFn = jest
      .fn()
      .mockRejectedValueOnce(new Error('Transient error'))
      .mockResolvedValue('success');

    const promise = retryWithBackoff(mockFn, 3, 100);

    // Advance timers to allow retry
    jest.runAllTimers();

    const result = await promise;

    expect(result).toBe('success');
    expect(mockFn).toHaveBeenCalledTimes(2);

    jest.useRealTimers();
  });

  it('should not retry on AuthenticationError', async () => {
    const mockFn = jest.fn().mockRejectedValue(new AuthenticationError('Auth failed'));

    await expect(retryWithBackoff(mockFn, 3)).rejects.toThrow(AuthenticationError);
    expect(mockFn).toHaveBeenCalledTimes(1); // No retry
  });

  it('should not retry on ForbiddenError', async () => {
    const mockFn = jest.fn().mockRejectedValue(new ForbiddenError('Forbidden'));

    await expect(retryWithBackoff(mockFn, 3)).rejects.toThrow(ForbiddenError);
    expect(mockFn).toHaveBeenCalledTimes(1);
  });

  it('should not retry on NotFoundError', async () => {
    const mockFn = jest.fn().mockRejectedValue(new NotFoundError('Not found'));

    await expect(retryWithBackoff(mockFn, 3)).rejects.toThrow(NotFoundError);
    expect(mockFn).toHaveBeenCalledTimes(1);
  });

  it('should respect retry-after for RateLimitError', async () => {
    jest.useFakeTimers();
    const mockFn = jest
      .fn()
      .mockRejectedValueOnce(new RateLimitError('Rate limited', 5))
      .mockResolvedValue('success');

    const promise = retryWithBackoff(mockFn, 3, 100);

    // Should wait for retry-after (5 seconds = 5000ms)
    jest.advanceTimersByTime(5000);

    const result = await promise;

    expect(result).toBe('success');
    expect(mockFn).toHaveBeenCalledTimes(2);

    jest.useRealTimers();
  });

  it('should throw after max retries exceeded', async () => {
    jest.useFakeTimers();
    const mockFn = jest.fn().mockRejectedValue(new Error('Persistent error'));

    const promise = retryWithBackoff(mockFn, 2, 100);

    jest.runAllTimers();

    await expect(promise).rejects.toThrow('Persistent error');
    expect(mockFn).toHaveBeenCalledTimes(3); // Initial + 2 retries

    jest.useRealTimers();
  });

  it('should use exponential backoff', async () => {
    jest.useFakeTimers();
    const mockFn = jest
      .fn()
      .mockRejectedValueOnce(new Error('Error 1'))
      .mockRejectedValueOnce(new Error('Error 2'))
      .mockResolvedValue('success');

    const promise = retryWithBackoff(mockFn, 3, 1000);

    // Advance through exponential delays
    jest.runAllTimers();

    await promise;

    expect(mockFn).toHaveBeenCalledTimes(3);

    jest.useRealTimers();
  });
});

describe('validateConfig', () => {
  it('should pass with all required variables', () => {
    const config = {
      REDDIT_CLIENT_ID: 'client123',
      REDDIT_CLIENT_SECRET: 'secret456',
      REDDIT_USER_AGENT: 'TestBot/1.0',
    };

    expect(() => validateConfig(config)).not.toThrow();
  });

  it('should throw when REDDIT_CLIENT_ID is missing', () => {
    const config = {
      REDDIT_CLIENT_SECRET: 'secret456',
      REDDIT_USER_AGENT: 'TestBot/1.0',
    };

    expect(() => validateConfig(config)).toThrow('REDDIT_CLIENT_ID');
  });

  it('should throw when REDDIT_CLIENT_SECRET is missing', () => {
    const config = {
      REDDIT_CLIENT_ID: 'client123',
      REDDIT_USER_AGENT: 'TestBot/1.0',
    };

    expect(() => validateConfig(config)).toThrow('REDDIT_CLIENT_SECRET');
  });

  it('should throw when REDDIT_USER_AGENT is missing', () => {
    const config = {
      REDDIT_CLIENT_ID: 'client123',
      REDDIT_CLIENT_SECRET: 'secret456',
    };

    expect(() => validateConfig(config)).toThrow('REDDIT_USER_AGENT');
  });

  it('should throw when multiple variables are missing', () => {
    const config = {
      REDDIT_CLIENT_ID: 'client123',
    };

    expect(() => validateConfig(config)).toThrow();
    expect(() => validateConfig(config)).toThrow('REDDIT_CLIENT_SECRET');
    expect(() => validateConfig(config)).toThrow('REDDIT_USER_AGENT');
  });

  it('should throw when all variables are missing', () => {
    const config = {};

    expect(() => validateConfig(config)).toThrow('REDDIT_CLIENT_ID');
    expect(() => validateConfig(config)).toThrow('REDDIT_CLIENT_SECRET');
    expect(() => validateConfig(config)).toThrow('REDDIT_USER_AGENT');
  });

  it('should allow extra environment variables', () => {
    const config = {
      REDDIT_CLIENT_ID: 'client123',
      REDDIT_CLIENT_SECRET: 'secret456',
      REDDIT_USER_AGENT: 'TestBot/1.0',
      EXTRA_VAR: 'extra',
      ANOTHER_VAR: 'another',
    };

    expect(() => validateConfig(config)).not.toThrow();
  });
});
