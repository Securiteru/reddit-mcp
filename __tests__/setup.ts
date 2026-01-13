/**
 * Jest test setup file
 * Runs before all tests
 */

// Set test environment variables
process.env.REDDIT_CLIENT_ID = 'test-client-id';
process.env.REDDIT_CLIENT_SECRET = 'test-client-secret';
process.env.REDDIT_USER_AGENT = 'TestBot/1.0 (by /u/testuser)';
process.env.REDDIT_USERNAME = 'testuser';
process.env.REDDIT_PASSWORD = 'testpassword';
process.env.RATE_LIMIT_PER_MINUTE = '60';
process.env.MAX_RETRIES = '3';

// Global test timeout
jest.setTimeout(10000);

// Suppress console.error during tests (optional)
const originalError = console.error;
beforeAll(() => {
  console.error = (...args: any[]) => {
    if (
      typeof args[0] === 'string' &&
      args[0].includes('Failed to refresh token')
    ) {
      return;
    }
    originalError.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
});
