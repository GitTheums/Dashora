import { type WidgetDataResponse, widgetDataResponseSchema } from "../../envelope.js";
import { type TwitchConfig, type TwitchData, twitchDataSchema } from "./config.js";
import { TWITCH_WIDGET_ID } from "./definition.js";

export class TwitchApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "TwitchApiError";
    this.status = status;
    this.code = code;
  }
}

export type TwitchClient = {
  fetchData: (
    instanceId: string,
    config: TwitchConfig,
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
  throw new TwitchApiError(response.status, code, message);
}

export function createTwitchClient(baseUrl = ""): TwitchClient {
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
        `${root}/api/v1/widgets/${TWITCH_WIDGET_ID}/instances/${encodeURIComponent(instanceId)}/data?${params.toString()}`,
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
        twitchDataSchema.parse(envelope.data);
      }
      return envelope;
    },
  };
}

export const defaultTwitchClient = createTwitchClient();

export function parseTwitchEnvelopeData(data: unknown): TwitchData {
  return twitchDataSchema.parse(data);
}
