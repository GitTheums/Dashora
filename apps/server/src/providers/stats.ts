import type {
  ProviderCounterStats,
  ProviderDiagnosticsEntry,
  ProviderHealthStatus,
  ProviderSafeError,
  ProviderTimingStats,
} from "@dashora/shared";
import type { CircuitBreaker } from "./circuit-breaker.js";
import type { ProviderError } from "./errors.js";
import type { ProviderRateLimiter } from "./rate-limiter.js";

type ProviderRuntimeStats = {
  counters: ProviderCounterStats;
  durationsMs: number[];
  lastDurationMs: number | null;
  lastError: ProviderSafeError | null;
};

const MAX_DURATION_SAMPLES = 50;

export function createProviderStatsRegistry(options: {
  rateLimiter: ProviderRateLimiter;
  circuitBreaker: CircuitBreaker;
}) {
  const stats = new Map<string, ProviderRuntimeStats>();

  function ensure(providerId: string): ProviderRuntimeStats {
    const existing = stats.get(providerId);
    if (existing) {
      return existing;
    }
    const created: ProviderRuntimeStats = {
      counters: {
        requests: 0,
        successes: 0,
        failures: 0,
        rateLimited: 0,
        circuitRejected: 0,
        deduplicated: 0,
      },
      durationsMs: [],
      lastDurationMs: null,
      lastError: null,
    };
    stats.set(providerId, created);
    return created;
  }

  function recordRequest(providerId: string): void {
    ensure(providerId).counters.requests += 1;
  }

  function recordSuccess(providerId: string, durationMs: number): void {
    const entry = ensure(providerId);
    entry.counters.successes += 1;
    entry.lastDurationMs = durationMs;
    entry.durationsMs.push(durationMs);
    if (entry.durationsMs.length > MAX_DURATION_SAMPLES) {
      entry.durationsMs.shift();
    }
    entry.lastError = null;
  }

  function recordFailure(providerId: string, error: ProviderError, durationMs?: number): void {
    const entry = ensure(providerId);
    entry.counters.failures += 1;
    entry.lastError = error.toSafeError();
    if (durationMs !== undefined) {
      entry.lastDurationMs = durationMs;
      entry.durationsMs.push(durationMs);
      if (entry.durationsMs.length > MAX_DURATION_SAMPLES) {
        entry.durationsMs.shift();
      }
    }
  }

  function recordRateLimited(providerId: string): void {
    ensure(providerId).counters.rateLimited += 1;
  }

  function recordCircuitRejected(providerId: string): void {
    ensure(providerId).counters.circuitRejected += 1;
  }

  function recordDeduplicated(providerId: string): void {
    ensure(providerId).counters.deduplicated += 1;
  }

  function averageDuration(entry: ProviderRuntimeStats): number | null {
    if (entry.durationsMs.length === 0) {
      return null;
    }
    const sum = entry.durationsMs.reduce((acc, value) => acc + value, 0);
    return Math.round(sum / entry.durationsMs.length);
  }

  function toIso(ms: number | null): string | null {
    return ms === null ? null : new Date(ms).toISOString();
  }

  function healthStatus(
    circuitState: "closed" | "open" | "half-open",
    entry: ProviderRuntimeStats | undefined,
  ): ProviderHealthStatus {
    if (!entry || entry.counters.requests === 0) {
      return "idle";
    }
    if (circuitState === "open") {
      return "open";
    }
    if (circuitState === "half-open" || entry.counters.failures > entry.counters.successes) {
      return "degraded";
    }
    return "healthy";
  }

  function listDiagnostics(): ProviderDiagnosticsEntry[] {
    const ids = new Set<string>([
      ...stats.keys(),
      ...options.rateLimiter.knownProviderIds(),
      ...options.circuitBreaker.knownProviderIds(),
    ]);

    return [...ids]
      .sort((a, b) => a.localeCompare(b))
      .map((id) => {
        const entry = ensure(id);
        const circuit = options.circuitBreaker.snapshot(id);
        const rate = options.rateLimiter.snapshot(id);
        const timings: ProviderTimingStats = {
          lastSuccessAt: toIso(circuit.lastSuccessAt),
          lastFailureAt: toIso(circuit.lastFailureAt),
          lastDurationMs: entry.lastDurationMs,
          averageDurationMs: averageDuration(entry),
        };
        return {
          id,
          status: healthStatus(circuit.state, entry),
          circuitState: circuit.state,
          rateLimit: {
            limit: rate.limit,
            remaining: rate.remaining,
            windowMs: rate.windowMs,
          },
          timings,
          counters: { ...entry.counters },
          lastError: entry.lastError,
        };
      });
  }

  function knownProviderIds(): string[] {
    return [...stats.keys()];
  }

  return {
    recordRequest,
    recordSuccess,
    recordFailure,
    recordRateLimited,
    recordCircuitRejected,
    recordDeduplicated,
    listDiagnostics,
    knownProviderIds,
  };
}

export type ProviderStatsRegistry = ReturnType<typeof createProviderStatsRegistry>;
