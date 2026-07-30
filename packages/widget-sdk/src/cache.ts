import { z } from "zod";

/**
 * Freshness and cache policy declared by each widget type.
 * The server owns the cache store; these values are hints and defaults.
 */
export const widgetCachePolicySchema = z.object({
  /** Time-to-live for a fresh cache entry, in seconds. */
  ttlSeconds: z.number().int().min(0).max(86_400),
  /**
   * After TTL, serve last-good data as `stale` for this many additional seconds
   * while revalidating. `0` means no stale window (miss after TTL).
   */
  staleWhileRevalidateSeconds: z.number().int().min(0).max(86_400).default(300),
  /** Include a normalized config hash in the cache key (almost always true). */
  varyByConfig: z.boolean().default(true),
  /** Include linked credential id in the cache key when present. */
  varyByCredential: z.boolean().default(true),
});

export type WidgetCachePolicy = z.infer<typeof widgetCachePolicySchema>;

export const widgetRefreshPolicySchema = z.object({
  /** Default polling / auto-refresh interval suggested to the client, in seconds. */
  defaultIntervalSeconds: z.number().int().min(0).max(86_400),
  /** Minimum interval between manual refreshes, in seconds. */
  minManualIntervalSeconds: z.number().int().min(0).max(3600).default(5),
});

export type WidgetRefreshPolicy = z.infer<typeof widgetRefreshPolicySchema>;

export const widgetCacheStatusSchema = z.enum(["hit", "miss", "stale", "bypass"]);

export type WidgetCacheStatus = z.infer<typeof widgetCacheStatusSchema>;

export const DEFAULT_WIDGET_CACHE_POLICY: WidgetCachePolicy = {
  ttlSeconds: 60,
  staleWhileRevalidateSeconds: 300,
  varyByConfig: true,
  varyByCredential: true,
};

export const DEFAULT_WIDGET_REFRESH_POLICY: WidgetRefreshPolicy = {
  defaultIntervalSeconds: 60,
  minManualIntervalSeconds: 5,
};
