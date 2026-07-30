import {
  type AuthUser,
  type LoginRequest,
  type SetupRequest,
  apiErrorSchema,
  authCsrfResponseSchema,
  authMeResponseSchema,
  loginResponseSchema,
  logoutResponseSchema,
  setupResponseSchema,
  setupStatusResponseSchema,
} from "@dashora/shared";

export class AuthApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "AuthApiError";
    this.status = status;
    this.code = code;
  }
}

function apiUrl(path: string, baseUrl: string): string {
  const normalizedBase = baseUrl.replace(/\/$/, "");
  return `${normalizedBase}${path}`;
}

function readCookie(name: string): string | null {
  if (typeof document === "undefined") {
    return null;
  }
  const prefix = `${name}=`;
  const parts = document.cookie.split("; ");
  for (const part of parts) {
    if (part.startsWith(prefix)) {
      return decodeURIComponent(part.slice(prefix.length));
    }
  }
  return null;
}

async function parseError(response: Response): Promise<AuthApiError> {
  try {
    const json: unknown = await response.json();
    const parsed = apiErrorSchema.safeParse(json);
    if (parsed.success) {
      return new AuthApiError(response.status, parsed.data.error.code, parsed.data.error.message);
    }
  } catch {
    // fall through
  }
  return new AuthApiError(response.status, "request_failed", "Request failed");
}

export type AuthApi = {
  getStatus: () => Promise<{ setupRequired: boolean }>;
  getMe: () => Promise<AuthUser | null>;
  ensureCsrf: () => Promise<string>;
  setup: (input: SetupRequest) => Promise<AuthUser>;
  login: (input: LoginRequest) => Promise<AuthUser>;
  logout: () => Promise<void>;
};

export function createAuthApi(baseUrl: string): AuthApi {
  async function request(path: string, init: RequestInit = {}): Promise<Response> {
    return fetch(apiUrl(path, baseUrl), {
      ...init,
      credentials: "include",
      headers: {
        ...(init.body ? { "content-type": "application/json" } : {}),
        ...init.headers,
      },
    });
  }

  async function ensureCsrf(): Promise<string> {
    const existing = readCookie("dashora_csrf");
    if (existing) {
      return existing;
    }
    const response = await request("/api/v1/auth/csrf");
    if (!response.ok) {
      throw await parseError(response);
    }
    const body = authCsrfResponseSchema.parse(await response.json());
    return body.csrfToken;
  }

  async function mutating(path: string, body: unknown): Promise<Response> {
    const csrfToken = await ensureCsrf();
    return request(path, {
      method: "POST",
      headers: {
        "x-csrf-token": csrfToken,
      },
      body: JSON.stringify(body),
    });
  }

  return {
    async getStatus() {
      const response = await request("/api/v1/setup/status");
      if (!response.ok) {
        throw await parseError(response);
      }
      return setupStatusResponseSchema.parse(await response.json());
    },

    async getMe() {
      const response = await request("/api/v1/auth/me");
      if (response.status === 401) {
        return null;
      }
      if (!response.ok) {
        throw await parseError(response);
      }
      return authMeResponseSchema.parse(await response.json()).user;
    },

    ensureCsrf,

    async setup(input) {
      const response = await mutating("/api/v1/setup/complete", input);
      if (!response.ok) {
        throw await parseError(response);
      }
      return setupResponseSchema.parse(await response.json()).user;
    },

    async login(input) {
      const response = await mutating("/api/v1/auth/login", input);
      if (!response.ok) {
        throw await parseError(response);
      }
      return loginResponseSchema.parse(await response.json()).user;
    },

    async logout() {
      const response = await mutating("/api/v1/auth/logout", {});
      if (!response.ok) {
        throw await parseError(response);
      }
      logoutResponseSchema.parse(await response.json());
    },
  };
}
