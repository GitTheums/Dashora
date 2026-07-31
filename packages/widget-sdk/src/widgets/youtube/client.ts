import { type WidgetDataResponse, widgetDataResponseSchema } from "../../envelope.js";
import { type YoutubeConfig, type YoutubeData, youtubeDataSchema } from "./config.js";
import { YOUTUBE_WIDGET_ID } from "./definition.js";

export class YoutubeApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "YoutubeApiError";
    this.status = status;
    this.code = code;
  }
}

export type YoutubeClient = {
  fetchData: (
    instanceId: string,
    config: YoutubeConfig,
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
  throw new YoutubeApiError(response.status, code, message);
}

export function createYoutubeClient(baseUrl = ""): YoutubeClient {
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
        `${root}/api/v1/widgets/${YOUTUBE_WIDGET_ID}/instances/${encodeURIComponent(instanceId)}/data?${params.toString()}`,
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
        youtubeDataSchema.parse(envelope.data);
      }
      return envelope;
    },
  };
}

export const defaultYoutubeClient = createYoutubeClient();

export function parseYoutubeEnvelopeData(data: unknown): YoutubeData {
  return youtubeDataSchema.parse(data);
}
