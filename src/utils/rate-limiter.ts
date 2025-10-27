/**
 * Token bucket rate limiter for Reddit API
 * Implements a sliding window rate limiting algorithm
 */

export class RateLimiter {
  private tokens: number;
  private readonly maxTokens: number;
  private readonly refillRate: number; // tokens per millisecond
  private lastRefill: number;
  private readonly queue: Array<{
    resolve: () => void;
    reject: (error: Error) => void;
  }> = [];

  constructor(requestsPerMinute: number = 60) {
    this.maxTokens = requestsPerMinute;
    this.tokens = requestsPerMinute;
    this.refillRate = requestsPerMinute / 60000; // tokens per millisecond
    this.lastRefill = Date.now();
  }

  /**
   * Refill tokens based on elapsed time
   */
  private refillTokens(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    const tokensToAdd = elapsed * this.refillRate;

    this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }

  /**
   * Acquire a token for making a request
   * Returns a promise that resolves when a token is available
   */
  async acquire(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.refillTokens();

      if (this.tokens >= 1) {
        this.tokens -= 1;
        resolve();
      } else {
        // Queue the request
        this.queue.push({ resolve, reject });
        this.scheduleRefill();
      }
    });
  }

  /**
   * Schedule the next refill check
   */
  private scheduleRefill(): void {
    if (this.queue.length === 0) return;

    const timeToNextToken = (1 - this.tokens) / this.refillRate;

    setTimeout(() => {
      this.refillTokens();
      this.processQueue();
    }, Math.ceil(timeToNextToken));
  }

  /**
   * Process queued requests
   */
  private processQueue(): void {
    while (this.queue.length > 0 && this.tokens >= 1) {
      const item = this.queue.shift();
      if (item) {
        this.tokens -= 1;
        item.resolve();
      }
    }

    if (this.queue.length > 0) {
      this.scheduleRefill();
    }
  }

  /**
   * Get current rate limit status
   */
  getStatus(): { remaining: number; total: number } {
    this.refillTokens();
    return {
      remaining: Math.floor(this.tokens),
      total: this.maxTokens,
    };
  }

  /**
   * Reset the rate limiter
   */
  reset(): void {
    this.tokens = this.maxTokens;
    this.lastRefill = Date.now();

    // Clear queue
    while (this.queue.length > 0) {
      const item = this.queue.shift();
      if (item) {
        item.reject(new Error('Rate limiter reset'));
      }
    }
  }
}
