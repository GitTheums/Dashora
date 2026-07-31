import { z } from "zod";

/** Operator-safe provider error codes (never include secret material). */
export const providerErrorCodeSchema = z.enum([
  "aborted",
  "timeout",
  "connect_timeout",
  "request_timeout",
  "too_large",
  "too_many_redirects",
  "http_error",
  "parse_error",
  "rate_limited",
  "circuit_open",
  "network_error",
  "invalid_url",
  "cancelled",
  "ssrf_blocked",
  "unknown",
]);

export type ProviderErrorCode = z.infer<typeof providerErrorCodeSchema>;

export const providerCircuitStateSchema = z.enum(["closed", "open", "half-open"]);

export type ProviderCircuitState = z.infer<typeof providerCircuitStateSchema>;

export const providerHealthStatusSchema = z.enum([
  "healthy",
  "degraded",
  "open",
  "idle",
  "unknown",
]);

export type ProviderHealthStatus = z.infer<typeof providerHealthStatusSchema>;

export const providerSafeErrorSchema = z.object({
  code: providerErrorCodeSchema,
  message: z.string().min(1),
});

export type ProviderSafeError = z.infer<typeof providerSafeErrorSchema>;

export const providerCacheMetricsSchema = z.object({
  hits: z.number().int().nonnegative(),
  misses: z.number().int().nonnegative(),
  stales: z.number().int().nonnegative(),
  bypasses: z.number().int().nonnegative(),
  stores: z.number().int().nonnegative(),
  notModified: z.number().int().nonnegative(),
  entryCount: z.number().int().nonnegative().optional(),
  hitRate: z.number().min(0).max(1).optional(),
});

export type ProviderCacheMetrics = z.infer<typeof providerCacheMetricsSchema>;

export const providerTimingStatsSchema = z.object({
  lastSuccessAt: z.string().datetime({ offset: true }).nullable(),
  lastFailureAt: z.string().datetime({ offset: true }).nullable(),
  lastDurationMs: z.number().nonnegative().nullable(),
  averageDurationMs: z.number().nonnegative().nullable(),
});

export type ProviderTimingStats = z.infer<typeof providerTimingStatsSchema>;

export const providerCounterStatsSchema = z.object({
  requests: z.number().int().nonnegative(),
  successes: z.number().int().nonnegative(),
  failures: z.number().int().nonnegative(),
  rateLimited: z.number().int().nonnegative(),
  circuitRejected: z.number().int().nonnegative(),
  deduplicated: z.number().int().nonnegative(),
});

export type ProviderCounterStats = z.infer<typeof providerCounterStatsSchema>;

export const providerRateLimitStatsSchema = z.object({
  limit: z.number().int().positive(),
  remaining: z.number().int().nonnegative(),
  windowMs: z.number().int().positive(),
});

export type ProviderRateLimitStats = z.infer<typeof providerRateLimitStatsSchema>;

export const providerDiagnosticsEntrySchema = z.object({
  id: z.string().min(1),
  status: providerHealthStatusSchema,
  circuitState: providerCircuitStateSchema,
  rateLimit: providerRateLimitStatsSchema,
  timings: providerTimingStatsSchema,
  counters: providerCounterStatsSchema,
  lastError: providerSafeErrorSchema.nullable(),
});

export type ProviderDiagnosticsEntry = z.infer<typeof providerDiagnosticsEntrySchema>;

export const providerPlatformConfigSchema = z.object({
  userAgent: z.string().min(1),
  connectTimeoutMs: z.number().int().positive(),
  requestTimeoutMs: z.number().int().positive(),
  maxResponseBytes: z.number().int().positive(),
  maxRedirects: z.number().int().nonnegative(),
});

export type ProviderPlatformConfig = z.infer<typeof providerPlatformConfigSchema>;

export const providerDiagnosticsResponseSchema = z.object({
  generatedAt: z.string().datetime({ offset: true }),
  cancelled: z.boolean(),
  platform: providerPlatformConfigSchema,
  cache: providerCacheMetricsSchema,
  providers: z.array(providerDiagnosticsEntrySchema),
});

export type ProviderDiagnosticsResponse = z.infer<typeof providerDiagnosticsResponseSchema>;
