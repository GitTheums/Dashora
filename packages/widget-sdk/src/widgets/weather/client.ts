import { type WidgetDataResponse, widgetDataResponseSchema } from "../../envelope.js";
import {
  type WeatherConfig,
  type WeatherData,
  type WeatherLocationSearchResponse,
  weatherDataSchema,
  weatherLocationSearchResponseSchema,
} from "./config.js";
import { WEATHER_WIDGET_ID } from "./definition.js";

export class WeatherApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "WeatherApiError";
    this.status = status;
    this.code = code;
  }
}

export type WeatherClient = {
  fetchData: (
    instanceId: string,
    config: WeatherConfig,
    options?: { forceRefresh?: boolean; signal?: AbortSignal },
  ) => Promise<WidgetDataResponse>;
  searchLocations: (
    query: string,
    options?: { signal?: AbortSignal; limit?: number },
  ) => Promise<WeatherLocationSearchResponse>;
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
    // ignore parse errors
  }
  throw new WeatherApiError(response.status, code, message);
}

export function createWeatherClient(baseUrl = ""): WeatherClient {
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
        `${root}/api/v1/widgets/${WEATHER_WIDGET_ID}/instances/${encodeURIComponent(instanceId)}/data?${params.toString()}`,
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
        weatherDataSchema.parse(envelope.data);
      }
      return envelope;
    },

    async searchLocations(query, options = {}) {
      const params = new URLSearchParams({ q: query });
      if (options.limit !== undefined) {
        params.set("limit", String(options.limit));
      }
      const response = await fetch(
        `${root}/api/v1/widgets/${WEATHER_WIDGET_ID}/locations?${params.toString()}`,
        {
          credentials: "include",
          ...(options.signal ? { signal: options.signal } : {}),
        },
      );
      if (!response.ok) {
        await fail(response);
      }
      return weatherLocationSearchResponseSchema.parse(await response.json());
    },
  };
}

export const defaultWeatherClient = createWeatherClient();

export function parseWeatherEnvelopeData(data: unknown): WeatherData {
  return weatherDataSchema.parse(data);
}
