import type { ProviderCircuitState } from "@dashora/shared";

export type CircuitBreakerOptions = {
  failureThreshold: number;
  openMs: number;
  now?: () => number;
};

export type CircuitSnapshot = {
  state: ProviderCircuitState;
  consecutiveFailures: number;
  openedAt: number | null;
  lastFailureAt: number | null;
  lastSuccessAt: number | null;
};

type CircuitRecord = {
  state: ProviderCircuitState;
  consecutiveFailures: number;
  openedAt: number | null;
  lastFailureAt: number | null;
  lastSuccessAt: number | null;
};

export function createCircuitBreaker(options: CircuitBreakerOptions) {
  const circuits = new Map<string, CircuitRecord>();
  const now = options.now ?? Date.now;

  function getOrCreate(providerId: string): CircuitRecord {
    const existing = circuits.get(providerId);
    if (existing) {
      return existing;
    }
    const created: CircuitRecord = {
      state: "closed",
      consecutiveFailures: 0,
      openedAt: null,
      lastFailureAt: null,
      lastSuccessAt: null,
    };
    circuits.set(providerId, created);
    return created;
  }

  function refreshState(record: CircuitRecord, at: number): CircuitRecord {
    if (record.state === "open" && record.openedAt !== null) {
      if (at - record.openedAt >= options.openMs) {
        record.state = "half-open";
      }
    }
    return record;
  }

  function allow(providerId: string): boolean {
    const at = now();
    const record = refreshState(getOrCreate(providerId), at);
    if (record.state === "open") {
      return false;
    }
    return true;
  }

  function recordSuccess(providerId: string): void {
    const at = now();
    const record = getOrCreate(providerId);
    record.state = "closed";
    record.consecutiveFailures = 0;
    record.openedAt = null;
    record.lastSuccessAt = at;
  }

  function recordFailure(providerId: string): void {
    const at = now();
    const record = refreshState(getOrCreate(providerId), at);
    record.consecutiveFailures += 1;
    record.lastFailureAt = at;
    if (record.state === "half-open" || record.consecutiveFailures >= options.failureThreshold) {
      record.state = "open";
      record.openedAt = at;
    }
  }

  function snapshot(providerId: string): CircuitSnapshot {
    const at = now();
    const record = refreshState(getOrCreate(providerId), at);
    return {
      state: record.state,
      consecutiveFailures: record.consecutiveFailures,
      openedAt: record.openedAt,
      lastFailureAt: record.lastFailureAt,
      lastSuccessAt: record.lastSuccessAt,
    };
  }

  function knownProviderIds(): string[] {
    return [...circuits.keys()];
  }

  function reset(providerId?: string): void {
    if (providerId) {
      circuits.delete(providerId);
      return;
    }
    circuits.clear();
  }

  return {
    allow,
    recordSuccess,
    recordFailure,
    snapshot,
    knownProviderIds,
    reset,
  };
}

export type CircuitBreaker = ReturnType<typeof createCircuitBreaker>;
