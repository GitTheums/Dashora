import { type WidgetDataResponse, widgetDataResponseSchema } from "../../envelope.js";
import { type LobstersConfig, type LobstersData, lobstersDataSchema } from "./config.js";
import { LOBSTERS_WIDGET_ID } from "./definition.js";

export class LobstersApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "LobstersApiError";
    this.status = status;
    this.code = code;
  }
}

export type LobstersClient = {
  fetchData: (
    instanceId: string,
    config: LobstersConfig,
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
  throw new LobstersApiError(response.status, code, message);
}

export function createLobstersClient(baseUrl = ""): LobstersClient {
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
        `${root}/api/v1/widgets/${LOBSTERS_WIDGET_ID}/instances/${encodeURIComponent(instanceId)}/data?${params.toString()}`,
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
        lobstersDataSchema.parse(envelope.data);
      }
      return envelope;
    },
  };
}

export const defaultLobstersClient = createLobstersClient();

export function parseLobstersEnvelopeData(data: unknown): LobstersData {
  return lobstersDataSchema.parse(data);
}
