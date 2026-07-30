import { type WidgetDataResponse, widgetDataResponseSchema } from "../../envelope.js";
import {
  type GithubReleasesConfig,
  type GithubReleasesData,
  githubReleasesDataSchema,
} from "./config.js";
import { GITHUB_RELEASES_WIDGET_ID } from "./definition.js";

export class GithubReleasesApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "GithubReleasesApiError";
    this.status = status;
    this.code = code;
  }
}

export type GithubReleasesClient = {
  fetchData: (
    instanceId: string,
    config: GithubReleasesConfig,
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
    // ignore parse errors
  }
  throw new GithubReleasesApiError(response.status, code, message);
}

export function createGithubReleasesClient(baseUrl = ""): GithubReleasesClient {
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
        `${root}/api/v1/widgets/${GITHUB_RELEASES_WIDGET_ID}/instances/${encodeURIComponent(instanceId)}/data?${params.toString()}`,
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
        githubReleasesDataSchema.parse(envelope.data);
      }
      return envelope;
    },
  };
}

export const defaultGithubReleasesClient = createGithubReleasesClient();

export function parseGithubReleasesEnvelopeData(data: unknown): GithubReleasesData {
  return githubReleasesDataSchema.parse(data);
}
