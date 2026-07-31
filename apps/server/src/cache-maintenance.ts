import type { CacheEntriesRepository } from "./db/repositories/cache-entries.js";

export type CacheMaintenanceOptions = {
  repository: CacheEntriesRepository;
  /** Purge interval in milliseconds. Default: 15 minutes. */
  intervalMs?: number;
  now?: () => number;
  onPurged?: (deleted: number) => void;
  log?: { info: (obj: unknown, msg?: string) => void };
};

/**
 * Periodically deletes expired provider cache rows to bound SQLite / container growth.
 */
export function startCacheMaintenance(options: CacheMaintenanceOptions): () => void {
  const intervalMs = options.intervalMs ?? 15 * 60 * 1000;
  const now = options.now ?? Date.now;

  const tick = async () => {
    try {
      const deleted = await options.repository.deleteExpired(now());
      if (deleted > 0) {
        options.onPurged?.(deleted);
        options.log?.info({ deleted }, "purged expired provider cache entries");
      }
    } catch (error) {
      options.log?.info({ err: error }, "provider cache purge failed");
    }
  };

  void tick();
  const timer = setInterval(() => {
    void tick();
  }, intervalMs);
  timer.unref?.();

  return () => {
    clearInterval(timer);
  };
}
