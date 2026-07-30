import {
  type ProviderDiagnosticsResponse,
  apiErrorSchema,
  providerDiagnosticsResponseSchema,
} from "@dashora/shared";

export class ProviderDiagnosticsApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ProviderDiagnosticsApiError";
    this.status = status;
    this.code = code;
  }
}

function apiUrl(path: string, baseUrl: string): string {
  const normalizedBase = baseUrl.replace(/\/$/, "");
  return `${normalizedBase}${path}`;
}

async function parseError(response: Response): Promise<ProviderDiagnosticsApiError> {
  try {
    const json: unknown = await response.json();
    const parsed = apiErrorSchema.safeParse(json);
    if (parsed.success) {
      return new ProviderDiagnosticsApiError(
        response.status,
        parsed.data.error.code,
        parsed.data.error.message,
      );
    }
  } catch {
    // fall through
  }
  return new ProviderDiagnosticsApiError(response.status, "request_failed", "Request failed");
}

export type ProviderDiagnosticsApi = {
  getDiagnostics: () => Promise<ProviderDiagnosticsResponse>;
};

export function createProviderDiagnosticsApi(baseUrl: string): ProviderDiagnosticsApi {
  return {
    async getDiagnostics() {
      const response = await fetch(apiUrl("/api/v1/admin/providers/diagnostics", baseUrl), {
        credentials: "include",
      });
      if (!response.ok) {
        throw await parseError(response);
      }
      const json: unknown = await response.json();
      return providerDiagnosticsResponseSchema.parse(json);
    },
  };
}
