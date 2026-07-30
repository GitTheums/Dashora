import type {
  ProviderDiagnosticsResponse,
  ProviderPlatformConfig,
  ServerEnv,
} from "@dashora/shared";
import { providerDiagnosticsResponseSchema } from "@dashora/shared";
import type { CacheEntriesRepository } from "../db/repositories/cache-entries.js";
import { computeBackoffMs, sleep } from "./backoff.js";
import { createCircuitBreaker } from "./circuit-breaker.js";
import { createRequestDeduper } from "./dedupe.js";
import { ProviderError, isProviderError, toProviderError } from "./errors.js";
import {
  type ProviderHttpClient,
  type ProviderHttpRequest,
  type ProviderHttpResponse,
  createProviderHttpClient,
} from "./http-client.js";
import { createCacheMetrics } from "./metrics.js";
import {
  type AtomFeed,
  type RssFeed,
  parseAtomXml,
  parseJsonText,
  parseRssXml,
  parseTextResponse,
  parseXml,
} from "./parsers/index.js";
import { createProviderRateLimiter } from "./rate-limiter.js";
import { createProviderStatsRegistry } from "./stats.js";
import { type SwrCachePolicy, type SwrCacheStatus, createProviderSwrCache } from "./swr-cache.js";

export type ProviderPlatformOptions = {
  env: Pick<
    ServerEnv,
    | "PROVIDER_USER_AGENT"
    | "PROVIDER_CONNECT_TIMEOUT_MS"
    | "PROVIDER_REQUEST_TIMEOUT_MS"
    | "PROVIDER_MAX_RESPONSE_BYTES"
    | "PROVIDER_MAX_REDIRECTS"
    | "PROVIDER_RATE_LIMIT_MAX"
    | "PROVIDER_RATE_LIMIT_WINDOW_MS"
    | "PROVIDER_CIRCUIT_FAILURE_THRESHOLD"
    | "PROVIDER_CIRCUIT_OPEN_MS"
    | "PROVIDER_CACHE_TTL_SECONDS"
    | "PROVIDER_CACHE_SWR_SECONDS"
  >;
  cacheRepository?: CacheEntriesRepository;
  fetchImpl?: typeof fetch;
  now?: () => number;
};

export type ProviderFetchOptions = {
  providerId: string;
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  signal?: AbortSignal;
  /** Bypass cache read/write. */
  forceRefresh?: boolean;
  /** Disable retries / backoff. */
  retry?: boolean;
  maxRetries?: number;
  cachePolicy?: Partial<SwrCachePolicy>;
  /** Skip rate limiter (tests / internal). */
  skipRateLimit?: boolean;
};

export type ProviderFetchResult = {
  response: ProviderHttpResponse;
  cacheStatus: SwrCacheStatus;
  fromCache: boolean;
  durationMs: number;
};

function defaultCachePolicy(
  env: ProviderPlatformOptions["env"],
  override?: Partial<SwrCachePolicy>,
): SwrCachePolicy {
  return {
    ttlSeconds: override?.ttlSeconds ?? env.PROVIDER_CACHE_TTL_SECONDS,
    staleWhileRevalidateSeconds:
      override?.staleWhileRevalidateSeconds ?? env.PROVIDER_CACHE_SWR_SECONDS,
  };
}

function isRetryableHttpStatus(status: number): boolean {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

export function createProviderPlatform(options: ProviderPlatformOptions) {
  const shutdownController = new AbortController();
  const now = options.now ?? Date.now;
  const metrics = createCacheMetrics();
  const rateLimiter = createProviderRateLimiter({
    maxRequests: options.env.PROVIDER_RATE_LIMIT_MAX,
    windowMs: options.env.PROVIDER_RATE_LIMIT_WINDOW_MS,
    now,
  });
  const circuitBreaker = createCircuitBreaker({
    failureThreshold: options.env.PROVIDER_CIRCUIT_FAILURE_THRESHOLD,
    openMs: options.env.PROVIDER_CIRCUIT_OPEN_MS,
    now,
  });
  const deduper = createRequestDeduper();
  const stats = createProviderStatsRegistry({ rateLimiter, circuitBreaker });
  const http: ProviderHttpClient = createProviderHttpClient({
    userAgent: options.env.PROVIDER_USER_AGENT,
    connectTimeoutMs: options.env.PROVIDER_CONNECT_TIMEOUT_MS,
    requestTimeoutMs: options.env.PROVIDER_REQUEST_TIMEOUT_MS,
    maxResponseBytes: options.env.PROVIDER_MAX_RESPONSE_BYTES,
    maxRedirects: options.env.PROVIDER_MAX_REDIRECTS,
    signal: shutdownController.signal,
    ...(options.fetchImpl ? { fetchImpl: options.fetchImpl } : {}),
  });

  const swr = options.cacheRepository
    ? createProviderSwrCache({
        repository: options.cacheRepository,
        metrics,
        now,
      })
    : null;

  const platformConfig: ProviderPlatformConfig = {
    userAgent: options.env.PROVIDER_USER_AGENT,
    connectTimeoutMs: options.env.PROVIDER_CONNECT_TIMEOUT_MS,
    requestTimeoutMs: options.env.PROVIDER_REQUEST_TIMEOUT_MS,
    maxResponseBytes: options.env.PROVIDER_MAX_RESPONSE_BYTES,
    maxRedirects: options.env.PROVIDER_MAX_REDIRECTS,
  };

  function assertNotCancelled(): void {
    if (shutdownController.signal.aborted) {
      throw new ProviderError("cancelled");
    }
  }

  async function executeUpstream(
    input: ProviderFetchOptions,
    validators: { etag?: string; lastModified?: string },
  ): Promise<ProviderHttpResponse> {
    const request: ProviderHttpRequest = {
      url: input.url,
      ...(input.method !== undefined ? { method: input.method } : {}),
      ...(input.headers !== undefined ? { headers: input.headers } : {}),
      ...(input.body !== undefined ? { body: input.body } : {}),
      ...(input.signal !== undefined ? { signal: input.signal } : {}),
      ...(validators.etag ? { etag: validators.etag } : {}),
      ...(validators.lastModified ? { lastModified: validators.lastModified } : {}),
    };

    const maxRetries = input.retry === false ? 0 : (input.maxRetries ?? 2);
    let attempt = 0;
    let lastError: ProviderError | undefined;

    while (attempt <= maxRetries) {
      assertNotCancelled();
      try {
        const response = await http.request(request);
        if (!response.ok && response.status !== 304 && isRetryableHttpStatus(response.status)) {
          throw new ProviderError("http_error", {
            statusCode: response.status,
            retryable: true,
          });
        }
        if (!response.ok && response.status !== 304) {
          throw new ProviderError("http_error", {
            statusCode: response.status,
            retryable: false,
          });
        }
        return response;
      } catch (error) {
        const providerError = isProviderError(error) ? error : toProviderError(error);
        lastError = providerError;
        if (!providerError.retryable || attempt >= maxRetries) {
          throw providerError;
        }
        const delay = computeBackoffMs({ attempt });
        await sleep(delay, combineOptionalSignals(shutdownController.signal, input.signal));
        attempt += 1;
      }
    }

    throw lastError ?? new ProviderError("unknown");
  }

  async function fetch(input: ProviderFetchOptions): Promise<ProviderFetchResult> {
    assertNotCancelled();
    const started = now();
    const providerId = input.providerId;
    stats.recordRequest(providerId);

    if (!circuitBreaker.allow(providerId)) {
      stats.recordCircuitRejected(providerId);
      const error = new ProviderError("circuit_open");
      stats.recordFailure(providerId, error);
      throw error;
    }

    if (!input.skipRateLimit) {
      const decision = rateLimiter.tryAcquire(providerId);
      if (!decision.allowed) {
        stats.recordRateLimited(providerId);
        const error = new ProviderError("rate_limited");
        stats.recordFailure(providerId, error);
        throw error;
      }
    }

    const policy = defaultCachePolicy(options.env, input.cachePolicy);
    const method = (input.method ?? "GET").toUpperCase();
    const cacheKey = swr ? swr.buildHttpCacheKey(providerId, method, input.url) : null;
    const dedupeKey = `${providerId}:${method}:${input.url}:${input.forceRefresh ? "fresh" : "cache"}`;

    const run = async (): Promise<ProviderFetchResult> => {
      let cacheStatus: SwrCacheStatus = "miss";
      let validators: { etag?: string; lastModified?: string } = {};
      let stalePayload:
        | {
            bodyText: string;
            status: number;
            headers: Record<string, string>;
            url: string;
            etag?: string;
            lastModified?: string;
          }
        | undefined;

      if (swr && cacheKey && method === "GET" && !input.forceRefresh) {
        const lookup = await swr.lookup(cacheKey);
        validators = lookup.validators;
        if (lookup.status === "hit") {
          circuitBreaker.recordSuccess(providerId);
          const durationMs = Math.max(0, now() - started);
          stats.recordSuccess(providerId, durationMs);
          return {
            response: {
              url: lookup.payload.url,
              status: lookup.payload.status,
              ok: true,
              headers: lookup.payload.headers,
              bodyText: lookup.payload.bodyText,
              redirected: false,
              notModified: false,
              ...(lookup.payload.etag ? { etag: lookup.payload.etag } : {}),
              ...(lookup.payload.lastModified ? { lastModified: lookup.payload.lastModified } : {}),
            },
            cacheStatus: "hit",
            fromCache: true,
            durationMs,
          };
        }
        if (lookup.status === "stale") {
          cacheStatus = "stale";
          stalePayload = lookup.payload;
        }
      } else if (input.forceRefresh) {
        metrics.record("bypass");
        cacheStatus = "bypass";
      }

      try {
        const upstream = await executeUpstream(input, validators);

        if (upstream.notModified && stalePayload) {
          if (swr && cacheKey) {
            await swr.touchNotModified(
              cacheKey,
              {
                kind: "http-response",
                url: stalePayload.url,
                status: stalePayload.status,
                headers: stalePayload.headers,
                bodyText: stalePayload.bodyText,
                ...(stalePayload.etag ? { etag: stalePayload.etag } : {}),
                ...(stalePayload.lastModified ? { lastModified: stalePayload.lastModified } : {}),
              },
              policy,
            );
          }
          circuitBreaker.recordSuccess(providerId);
          const durationMs = Math.max(0, now() - started);
          stats.recordSuccess(providerId, durationMs);
          return {
            response: {
              url: stalePayload.url,
              status: stalePayload.status,
              ok: true,
              headers: stalePayload.headers,
              bodyText: stalePayload.bodyText,
              redirected: false,
              notModified: true,
              ...(stalePayload.etag ? { etag: stalePayload.etag } : {}),
              ...(stalePayload.lastModified ? { lastModified: stalePayload.lastModified } : {}),
            },
            cacheStatus: cacheStatus === "stale" ? "stale" : "hit",
            fromCache: true,
            durationMs,
          };
        }

        if (swr && cacheKey && method === "GET" && upstream.ok) {
          await swr.store(
            cacheKey,
            {
              kind: "http-response",
              url: upstream.url,
              status: upstream.status,
              headers: upstream.headers,
              bodyText: upstream.bodyText,
              ...(upstream.etag ? { etag: upstream.etag } : {}),
              ...(upstream.lastModified ? { lastModified: upstream.lastModified } : {}),
            },
            policy,
          );
        }

        circuitBreaker.recordSuccess(providerId);
        const durationMs = Math.max(0, now() - started);
        stats.recordSuccess(providerId, durationMs);
        return {
          response: upstream,
          cacheStatus: cacheStatus === "stale" ? "miss" : cacheStatus,
          fromCache: false,
          durationMs,
        };
      } catch (error) {
        const providerError = isProviderError(error) ? error : toProviderError(error);
        if (stalePayload && providerError.code !== "cancelled") {
          circuitBreaker.recordFailure(providerId);
          const durationMs = Math.max(0, now() - started);
          stats.recordFailure(providerId, providerError, durationMs);
          return {
            response: {
              url: stalePayload.url,
              status: stalePayload.status,
              ok: true,
              headers: stalePayload.headers,
              bodyText: stalePayload.bodyText,
              redirected: false,
              notModified: false,
              ...(stalePayload.etag ? { etag: stalePayload.etag } : {}),
              ...(stalePayload.lastModified ? { lastModified: stalePayload.lastModified } : {}),
            },
            cacheStatus: "stale",
            fromCache: true,
            durationMs,
          };
        }
        circuitBreaker.recordFailure(providerId);
        const durationMs = Math.max(0, now() - started);
        stats.recordFailure(providerId, providerError, durationMs);
        throw providerError;
      }
    };

    const { value, shared } = await deduper.dedupe(dedupeKey, run);
    if (shared) {
      stats.recordDeduplicated(providerId);
    }
    return value;
  }

  async function fetchJson<T = unknown>(
    input: ProviderFetchOptions,
  ): Promise<{ data: T; result: ProviderFetchResult }> {
    const result = await fetch(input);
    return { data: parseJsonText<T>(result.response.bodyText), result };
  }

  async function fetchText(
    input: ProviderFetchOptions,
  ): Promise<{ text: string; result: ProviderFetchResult }> {
    const result = await fetch(input);
    return { text: parseTextResponse(result.response.bodyText), result };
  }

  async function fetchXml(
    input: ProviderFetchOptions,
  ): Promise<{ document: ReturnType<typeof parseXml>; result: ProviderFetchResult }> {
    const result = await fetch(input);
    return { document: parseXml(result.response.bodyText), result };
  }

  async function fetchRss(
    input: ProviderFetchOptions,
  ): Promise<{ feed: RssFeed; result: ProviderFetchResult }> {
    const result = await fetch(input);
    return { feed: parseRssXml(result.response.bodyText), result };
  }

  async function fetchAtom(
    input: ProviderFetchOptions,
  ): Promise<{ feed: AtomFeed; result: ProviderFetchResult }> {
    const result = await fetch(input);
    return { feed: parseAtomXml(result.response.bodyText), result };
  }

  function getDiagnostics(): ProviderDiagnosticsResponse {
    return providerDiagnosticsResponseSchema.parse({
      generatedAt: new Date(now()).toISOString(),
      cancelled: shutdownController.signal.aborted,
      platform: platformConfig,
      cache: metrics.snapshot(),
      providers: stats.listDiagnostics(),
    });
  }

  function cancel(): void {
    if (!shutdownController.signal.aborted) {
      shutdownController.abort(new ProviderError("cancelled"));
    }
  }

  return {
    fetch,
    fetchJson,
    fetchText,
    fetchXml,
    fetchRss,
    fetchAtom,
    getDiagnostics,
    cancel,
    isCancelled: () => shutdownController.signal.aborted,
    http,
    metrics,
    parsers: {
      parseJsonText,
      parseTextResponse,
      parseXml,
      parseRssXml,
      parseAtomXml,
    },
  };
}

function combineOptionalSignals(platform: AbortSignal, user?: AbortSignal): AbortSignal {
  if (!user) {
    return platform;
  }
  if (typeof AbortSignal.any === "function") {
    return AbortSignal.any([platform, user]);
  }
  const controller = new AbortController();
  const onAbort = () => {
    controller.abort();
  };
  if (platform.aborted || user.aborted) {
    controller.abort();
    return controller.signal;
  }
  platform.addEventListener("abort", onAbort, { once: true });
  user.addEventListener("abort", onAbort, { once: true });
  return controller.signal;
}

export type ProviderPlatform = ReturnType<typeof createProviderPlatform>;
