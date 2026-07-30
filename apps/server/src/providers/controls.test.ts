import { describe, expect, it } from "vitest";
import { computeBackoffMs } from "./backoff.js";
import { createCircuitBreaker } from "./circuit-breaker.js";
import { createProviderRateLimiter } from "./rate-limiter.js";

describe("provider backoff", () => {
  it("grows exponentially with a ceiling", () => {
    const first = computeBackoffMs({
      attempt: 0,
      baseMs: 100,
      maxMs: 1_000,
      jitterRatio: 0,
      random: () => 0,
    });
    const second = computeBackoffMs({
      attempt: 1,
      baseMs: 100,
      maxMs: 1_000,
      jitterRatio: 0,
      random: () => 0,
    });
    const capped = computeBackoffMs({
      attempt: 10,
      baseMs: 100,
      maxMs: 1_000,
      jitterRatio: 0,
      random: () => 0,
    });
    expect(first).toBe(100);
    expect(second).toBe(200);
    expect(capped).toBe(1_000);
  });
});

describe("provider rate limiter", () => {
  it("tracks remaining budget in a sliding window", () => {
    let now = 1_000;
    const limiter = createProviderRateLimiter({
      maxRequests: 2,
      windowMs: 1_000,
      now: () => now,
    });
    expect(limiter.tryAcquire("a").allowed).toBe(true);
    expect(limiter.tryAcquire("a").allowed).toBe(true);
    expect(limiter.tryAcquire("a").allowed).toBe(false);
    now = 2_100;
    expect(limiter.tryAcquire("a").allowed).toBe(true);
  });
});

describe("provider circuit breaker", () => {
  it("opens after the failure threshold and half-opens after the cool-down", () => {
    let now = 0;
    const breaker = createCircuitBreaker({
      failureThreshold: 2,
      openMs: 100,
      now: () => now,
    });
    expect(breaker.allow("p")).toBe(true);
    breaker.recordFailure("p");
    breaker.recordFailure("p");
    expect(breaker.allow("p")).toBe(false);
    expect(breaker.snapshot("p").state).toBe("open");
    now = 150;
    expect(breaker.allow("p")).toBe(true);
    expect(breaker.snapshot("p").state).toBe("half-open");
    breaker.recordSuccess("p");
    expect(breaker.snapshot("p").state).toBe("closed");
  });
});
