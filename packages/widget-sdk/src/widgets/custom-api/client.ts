import { type WidgetDataResponse, widgetDataResponseSchema } from "../../envelope.js";
import {
  type CustomApiConfig,
  type CustomApiData,
  type CustomApiPreviewResponse,
  customApiDataSchema,
  customApiPreviewResponseSchema,
} from "./config.js";
import { CUSTOM_API_WIDGET_ID } from "./definition.js";

export class CustomApiClientError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "CustomApiClientError";
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
  throw new CustomApiClientError(response.status, code, message);
}

function readCookie(name: string): string | null {
  if (typeof document === "undefined") {
    return null;
  }
  const prefix = `${name}=`;
  for (const part of document.cookie.split("; ")) {
    if (part.startsWith(prefix)) {
      return decodeURIComponent(part.slice(prefix.length));
    }
  }
  return null;
}

async function ensureCsrf(baseUrl: string): Promise<string> {
  const existing = readCookie("dashora_csrf");
  if (existing) {
    return existing;
  }
  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/api/v1/auth/csrf`, {
    credentials: "include",
  });
  if (!response.ok) {
    throw new CustomApiClientError(response.status, "csrf_failed", "Could not obtain CSRF token");
  }
  const body = (await response.json()) as { csrfToken: string };
  return body.csrfToken;
}

export type CustomApiClient = {
  fetchData: (
    instanceId: string,
    config: CustomApiConfig,
    options?: { forceRefresh?: boolean; signal?: AbortSignal },
  ) => Promise<WidgetDataResponse>;
  preview: (
    config: CustomApiConfig,
    options?: { signal?: AbortSignal },
  ) => Promise<CustomApiPreviewResponse>;
};

export function createCustomApiClient(baseUrl = ""): CustomApiClient {
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
        `${root}/api/v1/widgets/${CUSTOM_API_WIDGET_ID}/instances/${encodeURIComponent(instanceId)}/data?${params.toString()}`,
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
        customApiDataSchema.parse(envelope.data);
      }
      return envelope;
    },

    async preview(config, options = {}) {
      const response = await fetch(`${root}/api/v1/widgets/${CUSTOM_API_WIDGET_ID}/preview`, {
        method: "POST",
        credentials: "include",
        headers: {
          "content-type": "application/json",
          "x-csrf-token": await ensureCsrf(root),
        },
        body: JSON.stringify(config),
        ...(options.signal ? { signal: options.signal } : {}),
      });
      if (!response.ok) {
        await fail(response);
      }
      return customApiPreviewResponseSchema.parse(await response.json());
    },
  };
}

export const defaultCustomApiClient = createCustomApiClient();

export function parseCustomApiEnvelopeData(data: unknown): CustomApiData {
  return customApiDataSchema.parse(data);
}
