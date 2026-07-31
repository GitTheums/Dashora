import type { ProviderErrorCode, ProviderSafeError } from "@dashora/shared";

const SAFE_MESSAGES: Record<ProviderErrorCode, string> = {
  aborted: "The request was aborted.",
  timeout: "The upstream request timed out.",
  connect_timeout: "Connecting to the upstream provider timed out.",
  request_timeout: "The upstream request exceeded the total time budget.",
  too_large: "The upstream response exceeded the size limit.",
  too_many_redirects: "The upstream response redirected too many times.",
  http_error: "The upstream provider returned an error response.",
  parse_error: "The upstream response could not be parsed.",
  rate_limited: "This provider is temporarily rate limited.",
  circuit_open: "This provider is temporarily unavailable after repeated failures.",
  network_error: "A network error occurred while contacting the upstream provider.",
  invalid_url: "The provider URL is invalid.",
  ssrf_blocked: "The request target is blocked by outbound network protections.",
  cancelled: "The request was cancelled because the server is shutting down.",
  unknown: "An unexpected provider error occurred.",
};

export class ProviderError extends Error {
  readonly code: ProviderErrorCode;
  readonly statusCode?: number;
  readonly retryable: boolean;
  readonly causeMessage?: string;

  constructor(
    code: ProviderErrorCode,
    options: {
      message?: string;
      statusCode?: number;
      retryable?: boolean;
      cause?: unknown;
    } = {},
  ) {
    super(options.message ?? SAFE_MESSAGES[code]);
    this.name = "ProviderError";
    this.code = code;
    if (options.statusCode !== undefined) {
      this.statusCode = options.statusCode;
    }
    this.retryable = options.retryable ?? isRetryableCode(code);
    if (options.cause instanceof Error) {
      this.causeMessage = options.cause.message;
      this.cause = options.cause;
    }
  }

  /** Structured error safe to return to the browser / diagnostics UI. */
  toSafeError(): ProviderSafeError {
    return {
      code: this.code,
      message: SAFE_MESSAGES[this.code],
    };
  }
}

export function isProviderError(error: unknown): error is ProviderError {
  return error instanceof ProviderError;
}

export function toProviderError(error: unknown): ProviderError {
  if (error instanceof ProviderError) {
    return error;
  }
  if (error instanceof Error && error.name === "AbortError") {
    return new ProviderError("aborted", { cause: error });
  }
  if (error instanceof Error) {
    return new ProviderError("network_error", {
      message: SAFE_MESSAGES.network_error,
      cause: error,
    });
  }
  return new ProviderError("unknown");
}

function isRetryableCode(code: ProviderErrorCode): boolean {
  switch (code) {
    case "timeout":
    case "connect_timeout":
    case "request_timeout":
    case "network_error":
    case "http_error":
    case "rate_limited":
      return true;
    default:
      return false;
  }
}

export function safeMessageForCode(code: ProviderErrorCode): string {
  return SAFE_MESSAGES[code];
}
