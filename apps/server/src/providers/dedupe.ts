/**
 * In-flight request deduplication keyed by an opaque string.
 * Concurrent callers with the same key share one promise.
 */
export function createRequestDeduper() {
  const inflight = new Map<string, Promise<unknown>>();

  async function dedupe<T>(
    key: string,
    run: () => Promise<T>,
  ): Promise<{ value: T; shared: boolean }> {
    const existing = inflight.get(key);
    if (existing) {
      const value = (await existing) as T;
      return { value, shared: true };
    }

    const promise = run().finally(() => {
      if (inflight.get(key) === promise) {
        inflight.delete(key);
      }
    });
    inflight.set(key, promise);

    const value = await promise;
    return { value, shared: false };
  }

  function size(): number {
    return inflight.size;
  }

  function clear(): void {
    inflight.clear();
  }

  return { dedupe, size, clear };
}

export type RequestDeduper = ReturnType<typeof createRequestDeduper>;
