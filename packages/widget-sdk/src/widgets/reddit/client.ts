import { type WidgetDataResponse, widgetDataResponseSchema } from "../../envelope.js";
import { type RedditConfig, type RedditData, redditDataSchema } from "./config.js";
import { REDDIT_WIDGET_ID } from "./definition.js";

export class RedditApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "RedditApiError";
    this.status = status;
    this.code = code;
  }
}

export type RedditClient = {
  fetchData: (
    instanceId: string,
    config: RedditConfig,
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
  throw new RedditApiError(response.status, code, message);
}

export function createRedditClient(baseUrl = ""): RedditClient {
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
        `${root}/api/v1/widgets/${REDDIT_WIDGET_ID}/instances/${encodeURIComponent(instanceId)}/data?${params.toString()}`,
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
        redditDataSchema.parse(envelope.data);
      }
      return envelope;
    },
  };
}

export const defaultRedditClient = createRedditClient();

export function parseRedditEnvelopeData(data: unknown): RedditData {
  return redditDataSchema.parse(data);
}
