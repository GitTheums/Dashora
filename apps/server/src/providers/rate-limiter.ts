export type RateLimiterOptions = {
  maxRequests: number;
  windowMs: number;
  now?: () => number;
};

export type RateLimitDecision =
  | { allowed: true; remaining: number; limit: number; windowMs: number }
  | {
      allowed: false;
      remaining: 0;
      limit: number;
      windowMs: number;
      retryAfterMs: number;
    };

/**
 * Sliding-window rate limiter keyed by provider id.
 * Timestamps of accepted requests are retained for the window duration.
 */
export function createProviderRateLimiter(options: RateLimiterOptions) {
  const buckets = new Map<string, number[]>();
  const now = options.now ?? Date.now;

  function prune(timestamps: number[], at: number): number[] {
    const cutoff = at - options.windowMs;
    return timestamps.filter((ts) => ts > cutoff);
  }

  function snapshot(providerId: string): {
    remaining: number;
    limit: number;
    windowMs: number;
  } {
    const at = now();
    const timestamps = prune(buckets.get(providerId) ?? [], at);
    buckets.set(providerId, timestamps);
    return {
      remaining: Math.max(0, options.maxRequests - timestamps.length),
      limit: options.maxRequests,
      windowMs: options.windowMs,
    };
  }

  function tryAcquire(providerId: string): RateLimitDecision {
    const at = now();
    const timestamps = prune(buckets.get(providerId) ?? [], at);
    if (timestamps.length >= options.maxRequests) {
      const oldest = timestamps[0] ?? at;
      buckets.set(providerId, timestamps);
      return {
        allowed: false,
        remaining: 0,
        limit: options.maxRequests,
        windowMs: options.windowMs,
        retryAfterMs: Math.max(0, oldest + options.windowMs - at),
      };
    }
    timestamps.push(at);
    buckets.set(providerId, timestamps);
    return {
      allowed: true,
      remaining: Math.max(0, options.maxRequests - timestamps.length),
      limit: options.maxRequests,
      windowMs: options.windowMs,
    };
  }

  function reset(providerId?: string): void {
    if (providerId) {
      buckets.delete(providerId);
      return;
    }
    buckets.clear();
  }

  function knownProviderIds(): string[] {
    return [...buckets.keys()];
  }

  return {
    tryAcquire,
    snapshot,
    reset,
    knownProviderIds,
  };
}

export type ProviderRateLimiter = ReturnType<typeof createProviderRateLimiter>;
