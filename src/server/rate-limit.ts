// Fixed-window rate limiting for abuse-sensitive endpoints (checkout). In-memory like the
// login throttle — fine for the documented single-process deployment.

export interface RateDecision {
  allowed: boolean;
  retryInSeconds: number;
}

export interface RateLimiter {
  check(key: string, now?: number): RateDecision;
  reset(): void;
}

export function createRateLimiter(
  maxPerWindow: number,
  windowMs: number,
  sweepAt = 1000,
): RateLimiter {
  const buckets = new Map<string, { count: number; windowStart: number }>();

  return {
    check(key, now = Date.now()) {
      const entry = buckets.get(key);
      if (!entry || now - entry.windowStart > windowMs) {
        if (buckets.size >= sweepAt) {
          for (const [k, e] of buckets) {
            if (now - e.windowStart > windowMs) buckets.delete(k);
          }
        }
        buckets.set(key, { count: 1, windowStart: now });
        return { allowed: true, retryInSeconds: 0 };
      }
      if (entry.count >= maxPerWindow) {
        return {
          allowed: false,
          retryInSeconds: Math.ceil((entry.windowStart + windowMs - now) / 1000),
        };
      }
      entry.count += 1;
      return { allowed: true, retryInSeconds: 0 };
    },
    reset() {
      buckets.clear();
    },
  };
}
