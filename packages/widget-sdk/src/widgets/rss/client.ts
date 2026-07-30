import { type WidgetDataResponse, widgetDataResponseSchema } from "../../envelope.js";
import { type RssConfig, type RssData, rssDataSchema } from "./config.js";
import { RSS_WIDGET_ID } from "./definition.js";

export class RssApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "RssApiError";
    this.status = status;
    this.code = code;
  }
}

export type RssClient = {
  fetchData: (
    instanceId: string,
    config: RssConfig,
    options?: { forceRefresh?: boolean; signal?: AbortSignal },
  ) => Promise<WidgetDataResponse>;
};

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
  throw new RssApiError(response.status, code, message);
}

export function createRssClient(baseUrl = ""): RssClient {
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
        `${root}/api/v1/widgets/${RSS_WIDGET_ID}/instances/${encodeURIComponent(instanceId)}/data?${params.toString()}`,
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
        rssDataSchema.parse(envelope.data);
      }
      return envelope;
    },
  };
}

export const defaultRssClient = createRssClient();

export function parseRssEnvelopeData(data: unknown): RssData {
  return rssDataSchema.parse(data);
}
