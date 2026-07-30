import { type WidgetDataResponse, widgetDataResponseSchema } from "../../envelope.js";
import {
  type GithubRepositoryConfig,
  type GithubRepositoryData,
  githubRepositoryDataSchema,
} from "./config.js";
import { GITHUB_REPOSITORY_WIDGET_ID } from "./definition.js";

export class GithubRepositoryApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "GithubRepositoryApiError";
    this.status = status;
    this.code = code;
  }
}

export type GithubRepositoryClient = {
  fetchData: (
    instanceId: string,
    config: GithubRepositoryConfig,
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
  throw new GithubRepositoryApiError(response.status, code, message);
}

export function createGithubRepositoryClient(baseUrl = ""): GithubRepositoryClient {
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
        `${root}/api/v1/widgets/${GITHUB_REPOSITORY_WIDGET_ID}/instances/${encodeURIComponent(instanceId)}/data?${params.toString()}`,
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
        githubRepositoryDataSchema.parse(envelope.data);
      }
      return envelope;
    },
  };
}

export const defaultGithubRepositoryClient = createGithubRepositoryClient();

export function parseGithubRepositoryEnvelopeData(data: unknown): GithubRepositoryData {
  return githubRepositoryDataSchema.parse(data);
}
