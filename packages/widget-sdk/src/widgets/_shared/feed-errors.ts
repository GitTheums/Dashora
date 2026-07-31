/**
 * Typed adapter errors for feed-style widgets (HN, Lobsters, Reddit, YouTube, Twitch).
 * Messages must be operator-safe — never include secrets.
 */

export type FeedAdapterErrorCode =
  | "not_configured"
  | "unauthorized"
  | "rate_limited"
  | "forbidden"
  | "not_found"
  | "upstream"
  | "invalid_config";

export class FeedAdapterError extends Error {
  readonly code: FeedAdapterErrorCode;
  readonly statusCode?: number;
  readonly providerId: string;

  constructor(
    code: FeedAdapterErrorCode,
    message: string,
    options: { statusCode?: number; providerId: string; cause?: unknown },
  ) {
    super(message, options.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = "FeedAdapterError";
    this.code = code;
    this.providerId = options.providerId;
    if (options.statusCode !== undefined) {
      this.statusCode = options.statusCode;
    }
  }
}

export function isFeedAdapterError(error: unknown): error is FeedAdapterError {
  return error instanceof FeedAdapterError;
}

export function feedAdapterErrorToWidget(
  error: unknown,
  fallbackMessage: string,
  fallbackCode: string,
): {
  state: "error" | "configuration-required";
  message: string;
  errorCode: string;
} {
  if (isFeedAdapterError(error)) {
    if (error.code === "not_configured" || error.code === "unauthorized") {
      return {
        state: "configuration-required",
        message: error.message,
        errorCode: `${error.providerId}_${error.code}`,
      };
    }
    if (error.code === "forbidden") {
      return {
        state: "error",
        message: error.message,
        errorCode: `${error.providerId}_forbidden`,
      };
    }
    if (error.code === "rate_limited") {
      return {
        state: "error",
        message: error.message,
        errorCode: `${error.providerId}_rate_limited`,
      };
    }
    return {
      state: "error",
      message: error.message,
      errorCode: `${error.providerId}_${error.code}`,
    };
  }
  return {
    state: "error",
    message: fallbackMessage,
    errorCode: fallbackCode,
  };
}
