import {
  type CreateIcsBasicAuthIntegrationRequest,
  type IcsBasicAuthIntegrationPublic,
  type IcsBasicAuthIntegrationsResponse,
  type UpdateIcsBasicAuthIntegrationRequest,
  createIcsBasicAuthIntegrationRequestSchema,
  icsBasicAuthIntegrationResponseSchema,
  icsBasicAuthIntegrationsResponseSchema,
  updateIcsBasicAuthIntegrationRequestSchema,
} from "@dashora/shared";

export class IcsBasicAuthIntegrationsApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "IcsBasicAuthIntegrationsApiError";
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
    // ignore parse errors
  }
  throw new IcsBasicAuthIntegrationsApiError(response.status, code, message);
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
    throw new IcsBasicAuthIntegrationsApiError(
      response.status,
      "csrf_failed",
      "Could not obtain CSRF token",
    );
  }
  const body = (await response.json()) as { csrfToken: string };
  return body.csrfToken;
}

export type IcsBasicAuthIntegrationsClient = {
  list: (options?: { signal?: AbortSignal }) => Promise<IcsBasicAuthIntegrationsResponse>;
  create: (
    input: CreateIcsBasicAuthIntegrationRequest,
    options?: { signal?: AbortSignal },
  ) => Promise<IcsBasicAuthIntegrationPublic>;
  update: (
    id: string,
    input: UpdateIcsBasicAuthIntegrationRequest,
    options?: { signal?: AbortSignal },
  ) => Promise<IcsBasicAuthIntegrationPublic>;
  remove: (id: string, options?: { signal?: AbortSignal }) => Promise<void>;
};

export function createIcsBasicAuthIntegrationsClient(baseUrl = ""): IcsBasicAuthIntegrationsClient {
  const root = baseUrl.replace(/\/$/, "");

  return {
    async list(options = {}) {
      const response = await fetch(`${root}/api/v1/integrations/ics-basic-auth`, {
        credentials: "include",
        ...(options.signal ? { signal: options.signal } : {}),
      });
      if (!response.ok) {
        await fail(response);
      }
      return icsBasicAuthIntegrationsResponseSchema.parse(await response.json());
    },

    async create(input, options = {}) {
      const body = createIcsBasicAuthIntegrationRequestSchema.parse(input);
      const csrf = await ensureCsrf(root);
      const response = await fetch(`${root}/api/v1/integrations/ics-basic-auth`, {
        method: "POST",
        credentials: "include",
        headers: {
          "content-type": "application/json",
          "x-csrf-token": csrf,
        },
        body: JSON.stringify(body),
        ...(options.signal ? { signal: options.signal } : {}),
      });
      if (!response.ok) {
        await fail(response);
      }
      return icsBasicAuthIntegrationResponseSchema.parse(await response.json()).integration;
    },

    async update(id, input, options = {}) {
      const body = updateIcsBasicAuthIntegrationRequestSchema.parse(input);
      const csrf = await ensureCsrf(root);
      const response = await fetch(
        `${root}/api/v1/integrations/ics-basic-auth/${encodeURIComponent(id)}`,
        {
          method: "PATCH",
          credentials: "include",
          headers: {
            "content-type": "application/json",
            "x-csrf-token": csrf,
          },
          body: JSON.stringify(body),
          ...(options.signal ? { signal: options.signal } : {}),
        },
      );
      if (!response.ok) {
        await fail(response);
      }
      return icsBasicAuthIntegrationResponseSchema.parse(await response.json()).integration;
    },

    async remove(id, options = {}) {
      const csrf = await ensureCsrf(root);
      const response = await fetch(
        `${root}/api/v1/integrations/ics-basic-auth/${encodeURIComponent(id)}`,
        {
          method: "DELETE",
          credentials: "include",
          headers: {
            "x-csrf-token": csrf,
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

export const defaultIcsBasicAuthIntegrationsClient = createIcsBasicAuthIntegrationsClient();
