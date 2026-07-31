import {
  type DashboardThemeOverride,
  type ThemePreferences,
  apiErrorSchema,
  dashboardThemeResponseSchema,
  resetThemePreferencesResponseSchema,
  themePreferencesResponseSchema,
  updateDashboardThemeRequestSchema,
} from "@dashora/shared";

export class ThemeApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ThemeApiError";
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

async function parseError(response: Response): Promise<ThemeApiError> {
  try {
    const json: unknown = await response.json();
    const parsed = apiErrorSchema.safeParse(json);
    if (parsed.success) {
      return new ThemeApiError(response.status, parsed.data.error.code, parsed.data.error.message);
    }
  } catch {
    // fall through
  }
  return new ThemeApiError(response.status, "request_failed", "Request failed");
}

export type ThemeApi = {
  getPreferences: () => Promise<ThemePreferences>;
  savePreferences: (preferences: ThemePreferences) => Promise<ThemePreferences>;
  resetPreferences: () => Promise<ThemePreferences>;
  updateDashboardTheme: (
    themeOverride: DashboardThemeOverride | null,
  ) => Promise<DashboardThemeOverride | null>;
};

export function createThemeApi(baseUrl: string): ThemeApi {
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
    const body = (await response.json()) as { csrfToken: string };
    return body.csrfToken;
  }

  async function mutating(path: string, method: string, body?: unknown): Promise<Response> {
    const csrfToken = await ensureCsrf();
    return request(path, {
      method,
      headers: {
        "x-csrf-token": csrfToken,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  }

  return {
    async getPreferences() {
      const response = await request("/api/v1/settings/theme");
      if (!response.ok) {
        throw await parseError(response);
      }
      return themePreferencesResponseSchema.parse(await response.json()).preferences;
    },

    async savePreferences(preferences) {
      const response = await mutating("/api/v1/settings/theme", "PUT", preferences);
      if (!response.ok) {
        throw await parseError(response);
      }
      return themePreferencesResponseSchema.parse(await response.json()).preferences;
    },

    async resetPreferences() {
      const response = await mutating("/api/v1/settings/theme/reset", "POST", {});
      if (!response.ok) {
        throw await parseError(response);
      }
      return resetThemePreferencesResponseSchema.parse(await response.json()).preferences;
    },

    async updateDashboardTheme(themeOverride) {
      const payload = updateDashboardThemeRequestSchema.parse({ themeOverride });
      const response = await mutating("/api/v1/dashboard/theme", "PATCH", payload);
      if (!response.ok) {
        throw await parseError(response);
      }
      return dashboardThemeResponseSchema.parse(await response.json()).themeOverride;
    },
  };
}
