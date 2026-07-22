import { tooManyRequests } from "./errors.js";

class MemoryRateLimiter {
  constructor({ limit, windowMs }) {
    this.limit = limit;
    this.windowMs = windowMs;
    this.entries = new Map();
  }

  consume(key) {
    const now = Date.now();
    const current = this.entries.get(key);
    const entry = !current || current.resetAt <= now ? { count: 0, resetAt: now + this.windowMs } : current;
    entry.count += 1;
    this.entries.set(key, entry);

    if (entry.count > this.limit) {
      const retryAfterSeconds = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
      throw tooManyRequests("尝试次数过多，请稍后再试。", retryAfterSeconds);
    }
  }

  reset(key) {
    this.entries.delete(key);
  }
}

export const loginRateLimiter = new MemoryRateLimiter({ limit: 5, windowMs: 15 * 60 * 1000 });
export const subscriptionRateLimiter = new MemoryRateLimiter({ limit: 10, windowMs: 60 * 60 * 1000 });
export const writeRateLimiter = new MemoryRateLimiter({ limit: 90, windowMs: 60 * 1000 });
