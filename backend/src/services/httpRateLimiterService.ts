interface CounterState {
  count: number;
  resetAtMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export class HttpRateLimiterService {
  private readonly counters = new Map<string, CounterState>();

  consume(key: string, limit: number, windowMs: number): RateLimitResult {
    const now = Date.now();
    const existing = this.counters.get(key);

    if (!existing || existing.resetAtMs <= now) {
      this.counters.set(key, {
        count: 1,
        resetAtMs: now + windowMs
      });

      return {
        allowed: true,
        remaining: Math.max(0, limit - 1),
        retryAfterSeconds: Math.ceil(windowMs / 1000)
      };
    }

    if (existing.count >= limit) {
      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAtMs - now) / 1000))
      };
    }

    existing.count += 1;

    return {
      allowed: true,
      remaining: Math.max(0, limit - existing.count),
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAtMs - now) / 1000))
    };
  }
}
