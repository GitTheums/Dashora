import type { IframeEmbedProbe } from "./config.js";

export class IframeAdapterError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "IframeAdapterError";
    this.code = code;
  }
}

export function isIframeAdapterError(error: unknown): error is IframeAdapterError {
  return error instanceof IframeAdapterError;
}

export type IframeProbeRequest = {
  url: string;
  signal?: AbortSignal;
  now?: Date;
};

export type IframeAdapter = {
  id: string;
  probeEmbedding: (request: IframeProbeRequest) => Promise<IframeEmbedProbe>;
};
