/**
 * Error handling utilities for Reddit API
 */

import { AxiosError } from 'axios';

export class RedditAPIError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public errorCode?: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'RedditAPIError';
  }
}

export class RateLimitError extends RedditAPIError {
  constructor(
    message: string,
    public retryAfter: number
  ) {
    super(message, 429, 'RATE_LIMIT_EXCEEDED');
    this.name = 'RateLimitError';
  }
}

export class AuthenticationError extends RedditAPIError {
  constructor(message: string) {
    super(message, 401, 'AUTHENTICATION_FAILED');
    this.name = 'AuthenticationError';
  }
}

export class NotFoundError extends RedditAPIError {
  constructor(message: string) {
    super(message, 404, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

export class ForbiddenError extends RedditAPIError {
  constructor(message: string) {
    super(message, 403, 'FORBIDDEN');
    this.name = 'ForbiddenError';
  }
}

/**
 * Parse Reddit API error response
 */
export function parseRedditError(error: unknown): RedditAPIError {
  if (error instanceof AxiosError) {
    const status = error.response?.status;
    const data = error.response?.data;

    switch (status) {
      case 401:
        return new AuthenticationError(
          data?.message || 'Authentication failed. Please check your credentials.'
        );

      case 403:
        return new ForbiddenError(
          data?.message || 'Access forbidden. You may not have permission to access this resource.'
        );

      case 404:
        return new NotFoundError(
          data?.message || 'Resource not found.'
        );

      case 429: {
        const retryAfter = parseInt(error.response?.headers['retry-after'] || '60', 10);
        return new RateLimitError(
          `Rate limit exceeded. Retry after ${retryAfter} seconds.`,
          retryAfter
        );
      }

      case 500:
      case 502:
      case 503:
      case 504:
        return new RedditAPIError(
          'Reddit API is currently unavailable. Please try again later.',
          status,
          'SERVICE_UNAVAILABLE'
        );

      default:
        return new RedditAPIError(
          data?.message || error.message || 'An unknown error occurred',
          status,
          'UNKNOWN_ERROR',
          data
        );
    }
  }

  if (error instanceof Error) {
    return new RedditAPIError(error.message);
  }

  return new RedditAPIError('An unknown error occurred');
}

/**
 * Retry helper with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry on certain errors
      if (
        error instanceof AuthenticationError ||
        error instanceof ForbiddenError ||
        error instanceof NotFoundError
      ) {
        throw error;
      }

      // On last attempt, throw the error
      if (attempt === maxRetries) {
        break;
      }

      // Calculate delay with exponential backoff and jitter
      const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 1000;

      // For rate limit errors, respect the retry-after header
      if (error instanceof RateLimitError) {
        await sleep(error.retryAfter * 1000);
      } else {
        await sleep(delay);
      }
    }
  }

  throw lastError || new Error('Max retries exceeded');
}

/**
 * Sleep helper
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Validate required environment variables
 */
export function validateConfig(config: Record<string, string | undefined>): void {
  const required = ['REDDIT_CLIENT_ID', 'REDDIT_CLIENT_SECRET', 'REDDIT_USER_AGENT'];
  const missing = required.filter((key) => !config[key]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}\n` +
        'Please check your .env file or environment configuration.'
    );
  }
}
