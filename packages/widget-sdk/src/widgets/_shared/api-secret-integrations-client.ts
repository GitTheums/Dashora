import {
  type ApiSecretIntegrationPublic,
  type ApiSecretIntegrationsResponse,
  apiSecretIntegrationResponseSchema,
  apiSecretIntegrationsResponseSchema,
  createApiSecretIntegrationRequestSchema,
  updateApiSecretIntegrationRequestSchema,
} from "@dashora/shared";

export class ApiSecretIntegrationsApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ApiSecretIntegrationsApiError";
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
  throw new ApiSecretIntegrationsApiError(response.status, code, message);
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
    throw new ApiSecretIntegrationsApiError(
      response.status,
      "csrf_failed",
      "Could not obtain CSRF token",
    );
  }
  const body = (await response.json()) as { csrfToken: string };
  return body.csrfToken;
}

export type ApiSecretIntegrationsClient = {
  list: (options?: { signal?: AbortSignal }) => Promise<ApiSecretIntegrationsResponse>;
  create: (
    input: { name?: string; secret: string },
    options?: { signal?: AbortSignal },
  ) => Promise<ApiSecretIntegrationPublic>;
  update: (
    id: string,
    input: { name?: string; secret?: string },
    options?: { signal?: AbortSignal },
  ) => Promise<ApiSecretIntegrationPublic>;
  remove: (id: string, options?: { signal?: AbortSignal }) => Promise<void>;
};

export function createApiSecretIntegrationsClient(baseUrl = ""): ApiSecretIntegrationsClient {
  const root = baseUrl.replace(/\/$/, "");

  return {
    async list(options = {}) {
      const response = await fetch(`${root}/api/v1/integrations/api-secret`, {
        credentials: "include",
        ...(options.signal ? { signal: options.signal } : {}),
      });
      if (!response.ok) {
        await fail(response);
      }
      return apiSecretIntegrationsResponseSchema.parse(await response.json());
    },

    async create(input, options = {}) {
      const body = createApiSecretIntegrationRequestSchema.parse(input);
      const response = await fetch(`${root}/api/v1/integrations/api-secret`, {
        method: "POST",
        credentials: "include",
        headers: {
          "content-type": "application/json",
          "x-csrf-token": await ensureCsrf(root),
        },
        body: JSON.stringify(body),
        ...(options.signal ? { signal: options.signal } : {}),
      });
      if (!response.ok) {
        await fail(response);
      }
      return apiSecretIntegrationResponseSchema.parse(await response.json()).integration;
    },

    async update(id, input, options = {}) {
      const body = updateApiSecretIntegrationRequestSchema.parse(input);
      const response = await fetch(
        `${root}/api/v1/integrations/api-secret/${encodeURIComponent(id)}`,
        {
          method: "PATCH",
          credentials: "include",
          headers: {
            "content-type": "application/json",
            "x-csrf-token": await ensureCsrf(root),
          },
          body: JSON.stringify(body),
          ...(options.signal ? { signal: options.signal } : {}),
        },
      );
      if (!response.ok) {
        await fail(response);
      }
      return apiSecretIntegrationResponseSchema.parse(await response.json()).integration;
    },

    async remove(id, options = {}) {
      const response = await fetch(
        `${root}/api/v1/integrations/api-secret/${encodeURIComponent(id)}`,
        {
          method: "DELETE",
          credentials: "include",
          headers: {
            "x-csrf-token": await ensureCsrf(root),
          },
          ...(options.signal ? { signal: options.signal } : {}),
        },
      );
      if (!response.ok) {
        await fail(response);
      }
    },
  };
}

export const defaultApiSecretIntegrationsClient = createApiSecretIntegrationsClient();
