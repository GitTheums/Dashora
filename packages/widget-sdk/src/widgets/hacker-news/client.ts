import { type WidgetDataResponse, widgetDataResponseSchema } from "../../envelope.js";
import { type HackerNewsConfig, type HackerNewsData, hackerNewsDataSchema } from "./config.js";
import { HACKER_NEWS_WIDGET_ID } from "./definition.js";

export class HackerNewsApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "HackerNewsApiError";
    this.status = status;
    this.code = code;
  }
}

export type HackerNewsClient = {
  fetchData: (
    instanceId: string,
    config: HackerNewsConfig,
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
  throw new HackerNewsApiError(response.status, code, message);
}

export function createHackerNewsClient(baseUrl = ""): HackerNewsClient {
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
        `${root}/api/v1/widgets/${HACKER_NEWS_WIDGET_ID}/instances/${encodeURIComponent(instanceId)}/data?${params.toString()}`,
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
        hackerNewsDataSchema.parse(envelope.data);
      }
      return envelope;
    },
  };
}

export const defaultHackerNewsClient = createHackerNewsClient();

export function parseHackerNewsEnvelopeData(data: unknown): HackerNewsData {
  return hackerNewsDataSchema.parse(data);
}
