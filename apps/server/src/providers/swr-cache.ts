import { createHash } from "node:crypto";
import { z } from "zod";
import type { CacheEntriesRepository, JsonValue } from "../db/repositories/cache-entries.js";
import type { CacheMetrics } from "./metrics.js";

export type SwrCacheStatus = "hit" | "miss" | "stale" | "bypass";

export type HttpCacheValidators = {
  etag?: string;
  lastModified?: string;
};

export type StoredHttpCachePayload = {
  kind: "http-response";
  url: string;
  status: number;
  headers: Record<string, string>;
  bodyText: string;
  etag?: string;
  lastModified?: string;
};

const storedHttpCachePayloadSchema = z.object({
  kind: z.literal("http-response"),
  url: z.string(),
  status: z.number().int(),
  headers: z.record(z.string()),
  bodyText: z.string(),
  etag: z.string().optional(),
  lastModified: z.string().optional(),
});

export type SwrLookupResult =
  | {
      status: "hit" | "stale";
      payload: StoredHttpCachePayload;
      fetchedAt: number;
      staleAt: number;
      expiresAt: number;
      validators: HttpCacheValidators;
    }
  | {
      status: "miss";
      validators: HttpCacheValidators;
    };

export type SwrCachePolicy = {
  ttlSeconds: number;
  staleWhileRevalidateSeconds: number;
};

export type ProviderSwrCacheOptions = {
  repository: CacheEntriesRepository;
  metrics: CacheMetrics;
  now?: () => number;
};

function asJsonValue(payload: StoredHttpCachePayload): JsonValue {
  return payload as unknown as JsonValue;
}

function normalizeStoredPayload(
  value: z.infer<typeof storedHttpCachePayloadSchema>,
): StoredHttpCachePayload {
  return {
    kind: "http-response",
    url: value.url,
    status: value.status,
    headers: value.headers,
    bodyText: value.bodyText,
    ...(value.etag !== undefined ? { etag: value.etag } : {}),
    ...(value.lastModified !== undefined ? { lastModified: value.lastModified } : {}),
  };
}

export function buildHttpCacheKey(providerId: string, method: string, url: string): string {
  const digest = createHash("sha256").update(`${method.toUpperCase()}\n${url}`).digest("hex");
  return `provider-http:${providerId}:${digest}`;
}

export function createProviderSwrCache(options: ProviderSwrCacheOptions) {
  const now = options.now ?? Date.now;

  async function lookup(cacheKey: string): Promise<SwrLookupResult> {
    const entry = await options.repository.findByCacheKey(cacheKey);
    if (!entry) {
      options.metrics.record("miss");
      return { status: "miss", validators: {} };
    }

    const parsed = storedHttpCachePayloadSchema.safeParse(entry.payload);
    if (!parsed.success) {
      options.metrics.record("miss");
      return { status: "miss", validators: {} };
    }

    const payload = normalizeStoredPayload(parsed.data);
    const validators: HttpCacheValidators = {};
    if (payload.etag) {
      validators.etag = payload.etag;
    }
    if (payload.lastModified) {
      validators.lastModified = payload.lastModified;
    }

    const at = now();
    if (at < entry.staleAt) {
      options.metrics.record("hit");
      return {
        status: "hit",
        payload,
        fetchedAt: entry.fetchedAt,
        staleAt: entry.staleAt,
        expiresAt: entry.expiresAt,
        validators,
      };
    }

    if (at < entry.expiresAt) {
      options.metrics.record("stale");
      return {
        status: "stale",
        payload,
        fetchedAt: entry.fetchedAt,
        staleAt: entry.staleAt,
        expiresAt: entry.expiresAt,
        validators,
      };
    }

    options.metrics.record("miss");
    return { status: "miss", validators };
  }

  async function store(
    cacheKey: string,
    payload: StoredHttpCachePayload,
    policy: SwrCachePolicy,
  ): Promise<void> {
    const at = now();
    const staleAt = at + policy.ttlSeconds * 1000;
    const expiresAt = staleAt + policy.staleWhileRevalidateSeconds * 1000;
    await options.repository.upsertByCacheKey({
      cacheKey,
      payload: asJsonValue(payload),
      fetchedAt: at,
      staleAt,
      expiresAt,
      widgetId: null,
    });
    options.metrics.record("store");
  }

  async function touchNotModified(
    cacheKey: string,
    existing: StoredHttpCachePayload,
    policy: SwrCachePolicy,
  ): Promise<StoredHttpCachePayload> {
    options.metrics.record("not_modified");
    await store(cacheKey, existing, policy);
    return existing;
  }

  return {
    lookup,
    store,
    touchNotModified,
    buildHttpCacheKey,
  };
}

export type ProviderSwrCache = ReturnType<typeof createProviderSwrCache>;
