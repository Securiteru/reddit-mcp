/**
 * Unit tests for RateLimiter
 */

import { RateLimiter } from '../../../src/utils/rate-limiter';

describe('RateLimiter', () => {
  beforeEach(() => {
    jest.clearAllTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('constructor', () => {
    it('should initialize with default rate (60 requests per minute)', () => {
      const limiter = new RateLimiter();
      const status = limiter.getStatus();

      expect(status.total).toBe(60);
      expect(status.remaining).toBe(60);
    });

    it('should initialize with custom rate', () => {
      const limiter = new RateLimiter(30);
      const status = limiter.getStatus();

      expect(status.total).toBe(30);
      expect(status.remaining).toBe(30);
    });
  });

  describe('acquire', () => {
    it('should allow immediate acquisition when tokens available', async () => {
      const limiter = new RateLimiter(60);

      const start = Date.now();
      await limiter.acquire();
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(50); // Should be nearly instant

      const status = limiter.getStatus();
      expect(status.remaining).toBe(59);
    });

    it('should consume tokens on each acquisition', async () => {
      const limiter = new RateLimiter(60);

      await limiter.acquire();
      await limiter.acquire();
      await limiter.acquire();

      const status = limiter.getStatus();
      expect(status.remaining).toBe(57);
    });

    it('should queue requests when tokens exhausted', async () => {
      jest.useFakeTimers();
      const limiter = new RateLimiter(2);

      // Exhaust tokens
      await limiter.acquire(); // 1 token left
      await limiter.acquire(); // 0 tokens left

      // This should be queued
      const promise = limiter.acquire();

      // Advance time to allow token refill (1 token = 30 seconds for rate of 2/min)
      jest.advanceTimersByTime(30000);

      await promise;
      const status = limiter.getStatus();
      expect(status.remaining).toBe(0);

      jest.useRealTimers();
    });
  });

  describe('token refilling', () => {
    it('should refill tokens over time', async () => {
      jest.useFakeTimers();
      const limiter = new RateLimiter(60); // 1 token per second

      await limiter.acquire(); // 59 tokens left

      // Advance time by 5 seconds
      jest.advanceTimersByTime(5000);

      const status = limiter.getStatus();
      // Should have refilled ~5 tokens: 59 + 5 = 64, but capped at 60
      expect(status.remaining).toBe(60);

      jest.useRealTimers();
    });

    it('should not exceed maximum tokens', async () => {
      jest.useFakeTimers();
      const limiter = new RateLimiter(10);

      // Advance time by 10 minutes (should refill way more than max)
      jest.advanceTimersByTime(600000);

      const status = limiter.getStatus();
      expect(status.remaining).toBe(10); // Capped at max

      jest.useRealTimers();
    });

    it('should process queued requests after refill', async () => {
      jest.useFakeTimers();
      const limiter = new RateLimiter(2);

      // Exhaust all tokens
      await limiter.acquire();
      await limiter.acquire();

      // Queue 3 requests
      const promise1 = limiter.acquire();
      const promise2 = limiter.acquire();
      const promise3 = limiter.acquire();

      // Advance time to refill 3 tokens (90 seconds)
      jest.advanceTimersByTime(90000);

      await Promise.all([promise1, promise2, promise3]);

      const status = limiter.getStatus();
      expect(status.remaining).toBe(0);

      jest.useRealTimers();
    });
  });

  describe('getStatus', () => {
    it('should return current token status', () => {
      const limiter = new RateLimiter(100);
      const status = limiter.getStatus();

      expect(status).toHaveProperty('remaining');
      expect(status).toHaveProperty('total');
      expect(status.total).toBe(100);
      expect(status.remaining).toBe(100);
    });

    it('should update remaining tokens after acquisitions', async () => {
      const limiter = new RateLimiter(50);

      await limiter.acquire();
      await limiter.acquire();
      await limiter.acquire();

      const status = limiter.getStatus();
      expect(status.remaining).toBe(47);
      expect(status.total).toBe(50);
    });
  });

  describe('reset', () => {
    it('should reset tokens to maximum', async () => {
      const limiter = new RateLimiter(60);

      // Consume some tokens
      await limiter.acquire();
      await limiter.acquire();
      await limiter.acquire();

      limiter.reset();

      const status = limiter.getStatus();
      expect(status.remaining).toBe(60);
    });

    it('should clear queued requests with error', async () => {
      jest.useFakeTimers();
      const limiter = new RateLimiter(1);

      // Exhaust tokens
      await limiter.acquire();

      // Queue a request
      const queuedPromise = limiter.acquire();

      // Reset the limiter
      limiter.reset();

      // Queued request should be rejected
      await expect(queuedPromise).rejects.toThrow('Rate limiter reset');

      jest.useRealTimers();
    });

    it('should allow new acquisitions after reset', async () => {
      const limiter = new RateLimiter(5);

      // Exhaust tokens
      for (let i = 0; i < 5; i++) {
        await limiter.acquire();
      }

      limiter.reset();

      // Should be able to acquire immediately
      await limiter.acquire();
      const status = limiter.getStatus();
      expect(status.remaining).toBe(4);
    });
  });

  describe('concurrent requests', () => {
    it('should handle multiple concurrent acquisitions', async () => {
      const limiter = new RateLimiter(100);

      const promises = Array.from({ length: 10 }, () => limiter.acquire());

      await Promise.all(promises);

      const status = limiter.getStatus();
      expect(status.remaining).toBe(90);
    });

    it('should properly queue requests when rate limit exceeded', async () => {
      jest.useFakeTimers();
      const limiter = new RateLimiter(3);

      // Create 6 concurrent requests (3 immediate, 3 queued)
      const promises = Array.from({ length: 6 }, () => limiter.acquire());

      // Advance time to allow queue processing
      jest.advanceTimersByTime(60000); // 1 minute

      await Promise.all(promises);

      const status = limiter.getStatus();
      expect(status.remaining).toBe(0);

      jest.useRealTimers();
    });
  });

  describe('edge cases', () => {
    it('should handle zero tokens gracefully', async () => {
      jest.useFakeTimers();
      const limiter = new RateLimiter(1);

      await limiter.acquire(); // Consume the only token

      const promise = limiter.acquire();

      // Should queue and eventually resolve
      jest.advanceTimersByTime(60000);

      await promise;
      expect(true).toBe(true); // If we get here, it worked

      jest.useRealTimers();
    });

    it('should handle rapid successive acquisitions', async () => {
      const limiter = new RateLimiter(1000); // High rate

      for (let i = 0; i < 10; i++) {
        await limiter.acquire();
      }

      const status = limiter.getStatus();
      expect(status.remaining).toBe(990);
    });
  });
});
