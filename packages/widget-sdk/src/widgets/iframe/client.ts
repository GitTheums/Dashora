import { type WidgetDataResponse, widgetDataResponseSchema } from "../../envelope.js";
import { type IframeConfig, type IframeData, iframeDataSchema } from "./config.js";
import { IFRAME_WIDGET_ID } from "./definition.js";

export class IframeApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "IframeApiError";
    this.status = status;
    this.code = code;
  }
}

async function fail(response: Response): Promise<never> {
  let code = "request_failed";
  let message = "Request failed";
  try {
    const json = (await response.json()) as {
      error?: { code?: string; message?: string };
    };
    code = json.error?.code ?? code;
    message = json.error?.message ?? message;
  } catch {
    // ignore
  }
  throw new IframeApiError(response.status, code, message);
}

export type IframeClient = {
  fetchData: (
    instanceId: string,
    config: IframeConfig,
    options?: { forceRefresh?: boolean; signal?: AbortSignal },
  ) => Promise<WidgetDataResponse>;
};

export function createIframeClient(baseUrl = ""): IframeClient {
  const root = baseUrl.replace(/\/$/, "");

  return {
    async fetchData(instanceId, config, options = {}) {
      const params = new URLSearchParams({
        config: JSON.stringify(config),
      });
      if (options.forceRefresh) {
        params.set("refresh", "1");
      }
      const response = await fetch(
        `${root}/api/v1/widgets/${IFRAME_WIDGET_ID}/instances/${encodeURIComponent(instanceId)}/data?${params.toString()}`,
        {
          credentials: "include",
          ...(options.signal ? { signal: options.signal } : {}),
        },
      );
      if (!response.ok) {
        await fail(response);
      }
      const envelope = widgetDataResponseSchema.parse(await response.json());
      if (envelope.data !== undefined) {
        iframeDataSchema.parse(envelope.data);
      }
      return envelope;
    },
  };
}

export const defaultIframeClient = createIframeClient();

export function parseIframeEnvelopeData(data: unknown): IframeData {
  return iframeDataSchema.parse(data);
}
