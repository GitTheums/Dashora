import type { CustomApiConfig, CustomApiData } from "./config.js";

export class CustomApiAdapterError extends Error {
  readonly code: string;
  readonly retryable: boolean;

  constructor(code: string, message: string, retryable = false) {
    super(message);
    this.name = "CustomApiAdapterError";
    this.code = code;
    this.retryable = retryable;
  }
}

export function isCustomApiAdapterError(error: unknown): error is CustomApiAdapterError {
  return error instanceof CustomApiAdapterError;
}

export type CustomApiFetchRequest = {
  config: CustomApiConfig;
  /** Resolve api-secret integration values by id. */
  resolveSecret: (secretId: string) => Promise<string | null>;
  signal?: AbortSignal;
  forceRefresh?: boolean;
  now?: Date;
};

export type CustomApiFetchResult = {
  data: CustomApiData;
  cacheStatus: "hit" | "miss" | "stale" | "bypass";
};

export type CustomApiAdapter = {
  id: string;
  fetch: (request: CustomApiFetchRequest) => Promise<CustomApiFetchResult>;
};
