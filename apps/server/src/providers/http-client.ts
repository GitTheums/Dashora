import { ProviderError, toProviderError } from "./errors.js";
import { createPinnedDispatcher } from "./pinned-dispatcher.js";
import { redactHeaders } from "./redact.js";

/**
 * Minimal shape `validateUrl` may resolve to. Deliberately narrower than
 * `SsrfValidationResult` (which also carries the parsed `URL`) so callers/tests can return just
 * the address list without needing to reconstruct a `URL` object.
 */
export type UrlValidationResult = { addresses?: string[] };

export type ProviderHttpClientOptions = {
  userAgent: string;
  connectTimeoutMs: number;
  requestTimeoutMs: number;
  maxResponseBytes: number;
  maxRedirects: number;
  /** Platform-level abort signal (cancelled on server shutdown). */
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
};

export type ProviderHttpRequest = {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string | undefined;
  signal?: AbortSignal;
  /** When set, sent as If-None-Match. */
  etag?: string;
  /** When set, sent as If-Modified-Since. */
  lastModified?: string;
  /** Override default redirects. */
  maxRedirects?: number;
  /**
   * Optional SSRF / allow-list guard. Invoked for the initial URL and every redirect target.
   * Throw ProviderError to abort the request. May return the validated IP address(es) for the
   * URL's hostname (e.g. from `createSsrfUrlValidator`) — when present, the actual TCP
   * connection is pinned to those addresses to prevent DNS-rebinding between validation and
   * connect time.
   */
  validateUrl?: (
    url: string,
  ) => undefined | UrlValidationResult | Promise<undefined | UrlValidationResult>;
};

export type ProviderHttpResponse = {
  url: string;
  status: number;
  ok: boolean;
  headers: Record<string, string>;
  bodyText: string;
  etag?: string;
  lastModified?: string;
  redirected: boolean;
  /** True when upstream returned 304 and body came from cache caller. */
  notModified: boolean;
};

type MutableAbort = {
  controller: AbortController;
  timers: ReturnType<typeof setTimeout>[];
};

function combineSignals(signals: AbortSignal[]): AbortSignal {
  const active = signals.filter((signal) => signal != null);
  if (active.length === 0) {
    return new AbortController().signal;
  }
  if (typeof AbortSignal.any === "function") {
    return AbortSignal.any(active);
  }
  const controller = new AbortController();
  for (const signal of active) {
    if (signal.aborted) {
      controller.abort(signal.reason);
      return controller.signal;
    }
    signal.addEventListener(
      "abort",
      () => {
        controller.abort(signal.reason);
      },
      { once: true },
    );
  }
  return controller.signal;
}

function headerRecord(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  headers.forEach((value, key) => {
    out[key] = value;
  });
  return out;
}

function pickHeader(headers: Headers, name: string): string | undefined {
  return headers.get(name) ?? undefined;
}

async function readBodyLimited(
  response: Response,
  maxBytes: number,
  signal: AbortSignal,
): Promise<string> {
  if (!response.body) {
    return "";
  }

  // Fail fast on an oversized declared Content-Length before streaming any of the body —
  // the streaming cap below still protects against a lying/absent header.
  const declaredLength = pickHeader(response.headers, "content-length");
  if (declaredLength !== undefined) {
    const parsedLength = Number(declaredLength);
    if (Number.isFinite(parsedLength) && parsedLength > maxBytes) {
      throw new ProviderError("too_large");
    }
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    while (true) {
      if (signal.aborted) {
        throw new ProviderError("aborted");
      }
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      if (!value) {
        continue;
      }
      total += value.byteLength;
      if (total > maxBytes) {
        try {
          await reader.cancel();
        } catch {
          // ignore cancel errors
        }
        throw new ProviderError("too_large");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder("utf-8").decode(merged);
}

function mapAbortToProviderError(error: unknown, phase: "connect" | "request"): ProviderError {
  if (error instanceof ProviderError) {
    return error;
  }
  if (error instanceof Error && error.name === "AbortError") {
    return new ProviderError(phase === "connect" ? "connect_timeout" : "request_timeout", {
      cause: error,
    });
  }
  return toProviderError(error);
}

/** Fastify/Node's global `fetch` accepts a non-standard `dispatcher` option (undici). */
type FetchInitWithDispatcher = RequestInit & { dispatcher?: import("undici").Agent };

export function createProviderHttpClient(options: ProviderHttpClientOptions) {
  const fetchImpl = options.fetchImpl ?? fetch;

  async function request(input: ProviderHttpRequest): Promise<ProviderHttpResponse> {
    let currentUrl: string;
    try {
      currentUrl = new URL(input.url).toString();
    } catch (error) {
      throw new ProviderError("invalid_url", { cause: error });
    }

    let pinnedAddresses: string[] | undefined;
    if (input.validateUrl) {
      const result = await input.validateUrl(currentUrl);
      pinnedAddresses = result?.addresses;
    }

    const method = (input.method ?? "GET").toUpperCase();
    const maxRedirects = input.maxRedirects ?? options.maxRedirects;
    let redirected = false;

    for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount += 1) {
      const dispatcher =
        pinnedAddresses && pinnedAddresses.length > 0
          ? createPinnedDispatcher(new URL(currentUrl).hostname, pinnedAddresses)
          : undefined;
      const mutable: MutableAbort = {
        controller: new AbortController(),
        timers: [],
      };

      const connectTimer = setTimeout(() => {
        mutable.controller.abort(
          new ProviderError("connect_timeout", {
            message: "Connecting to the upstream provider timed out.",
          }),
        );
      }, options.connectTimeoutMs);
      mutable.timers.push(connectTimer);

      const requestTimer = setTimeout(() => {
        mutable.controller.abort(
          new ProviderError("request_timeout", {
            message: "The upstream request exceeded the total time budget.",
          }),
        );
      }, options.requestTimeoutMs);
      mutable.timers.push(requestTimer);

      const signal = combineSignals([
        mutable.controller.signal,
        ...(options.signal ? [options.signal] : []),
        ...(input.signal ? [input.signal] : []),
      ]);

      if (options.signal?.aborted) {
        throw new ProviderError("cancelled");
      }

      const headers = new Headers(input.headers ?? {});
      if (!headers.has("user-agent")) {
        headers.set("user-agent", options.userAgent);
      }
      if (input.etag) {
        headers.set("if-none-match", input.etag);
      }
      if (input.lastModified) {
        headers.set("if-modified-since", input.lastModified);
      }

      try {
        let response: Response;
        try {
          response = await fetchImpl(currentUrl, {
            method,
            headers,
            ...(method === "GET" || method === "HEAD" || input.body === undefined
              ? {}
              : { body: input.body }),
            redirect: "manual",
            signal,
            ...(dispatcher ? { dispatcher } : {}),
          } as FetchInitWithDispatcher);
          clearTimeout(connectTimer);
        } catch (error) {
          for (const timer of mutable.timers) {
            clearTimeout(timer);
          }
          if (options.signal?.aborted) {
            throw new ProviderError("cancelled", { cause: error });
          }
          if (input.signal?.aborted) {
            throw new ProviderError("aborted", { cause: error });
          }
          throw mapAbortToProviderError(error, "connect");
        }

        const status = response.status;
        const isRedirect =
          status === 301 || status === 302 || status === 303 || status === 307 || status === 308;
        if (isRedirect) {
          const location = response.headers.get("location");
          // Drain body to free connection.
          try {
            await response.arrayBuffer();
          } catch {
            // ignore
          }
          for (const timer of mutable.timers) {
            clearTimeout(timer);
          }
          if (!location) {
            throw new ProviderError("http_error", { statusCode: status });
          }
          if (redirectCount >= maxRedirects) {
            throw new ProviderError("too_many_redirects");
          }
          currentUrl = new URL(location, currentUrl).toString();
          if (input.validateUrl) {
            const result = await input.validateUrl(currentUrl);
            pinnedAddresses = result?.addresses;
          } else {
            pinnedAddresses = undefined;
          }
          redirected = true;
          continue;
        }

        let bodyText: string;
        try {
          bodyText = await readBodyLimited(response, options.maxResponseBytes, signal);
        } catch (error) {
          for (const timer of mutable.timers) {
            clearTimeout(timer);
          }
          if (options.signal?.aborted) {
            throw new ProviderError("cancelled", { cause: error });
          }
          throw mapAbortToProviderError(error, "request");
        } finally {
          for (const timer of mutable.timers) {
            clearTimeout(timer);
          }
        }

        const etag = pickHeader(response.headers, "etag");
        const lastModified = pickHeader(response.headers, "last-modified");
        const headersObject = redactHeaders(headerRecord(response.headers));

        return {
          url: currentUrl,
          status,
          ok: status >= 200 && status < 300,
          headers: headersObject,
          bodyText,
          redirected,
          notModified: status === 304,
          ...(etag ? { etag } : {}),
          ...(lastModified ? { lastModified } : {}),
        };
      } finally {
        if (dispatcher) {
          dispatcher.close().catch(() => {
            // Best-effort cleanup of pinned-dispatcher sockets; never fails the request.
          });
        }
      }
    }

    throw new ProviderError("too_many_redirects");
  }

  return {
    request,
    options: {
      userAgent: options.userAgent,
      connectTimeoutMs: options.connectTimeoutMs,
      requestTimeoutMs: options.requestTimeoutMs,
      maxResponseBytes: options.maxResponseBytes,
      maxRedirects: options.maxRedirects,
    },
  };
}

export type ProviderHttpClient = ReturnType<typeof createProviderHttpClient>;
