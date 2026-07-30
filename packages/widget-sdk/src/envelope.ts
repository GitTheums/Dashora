import { z } from "zod";
import { widgetCacheStatusSchema } from "./cache.js";
import { widgetStateSchema } from "./states.js";

/**
 * Shared API response envelope for widget data endpoints.
 * Clients should validate with Zod before rendering.
 */
export const widgetResponseMetaSchema = z.object({
  /** ISO-8601 timestamp when the payload was produced or last confirmed fresh. */
  fetchedAt: z.string().datetime({ offset: true }),
  /** ISO-8601 timestamp when the payload should be considered past TTL. */
  expiresAt: z.string().datetime({ offset: true }).optional(),
  /** ISO-8601 timestamp after which the client should treat data as stale. */
  staleAt: z.string().datetime({ offset: true }).optional(),
  cache: widgetCacheStatusSchema.optional(),
  /** Config schema version used to interpret instance settings for this response. */
  schemaVersion: z.number().int().min(1),
  /** Widget package / definition version string. */
  widgetVersion: z.string().min(1).optional(),
});

export type WidgetResponseMeta = z.infer<typeof widgetResponseMetaSchema>;

export const widgetDataResponseSchema = z.object({
  widgetId: z.string().min(1),
  instanceId: z.string().min(1),
  state: widgetStateSchema,
  /** Sanitized payload for dataful states; omitted for loading / error shells. */
  data: z.unknown().optional(),
  /** Operator-safe message (errors, empty copy, configuration hints). */
  message: z.string().min(1).max(500).optional(),
  /** Machine-readable error code when state is `error`. */
  errorCode: z.string().min(1).max(64).optional(),
  meta: widgetResponseMetaSchema,
});

export type WidgetDataResponse = z.infer<typeof widgetDataResponseSchema>;

export function createWidgetDataResponse(input: WidgetDataResponse): WidgetDataResponse {
  return widgetDataResponseSchema.parse(input);
}
