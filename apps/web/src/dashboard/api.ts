import {
  type CreatePageRequest,
  type CreatePageWidgetRequest,
  type CreatePageWidgetResponse,
  type Dashboard,
  type Page,
  type PageLayoutDocument,
  type PageLayoutResponse,
  type UpdatePageRequest,
  apiErrorSchema,
  createPageWidgetResponseSchema,
  dashboardResponseSchema,
  deletePageResponseSchema,
  pageLayoutResponseSchema,
  pageResponseSchema,
} from "@dashora/shared";
import type { ZodError } from "zod";

export class DashboardApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "DashboardApiError";
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

async function parseError(response: Response): Promise<DashboardApiError> {
  try {
    const json: unknown = await response.json();
    const parsed = apiErrorSchema.safeParse(json);
    if (parsed.success) {
      return new DashboardApiError(
        response.status,
        parsed.data.error.code,
        parsed.data.error.message,
      );
    }
  } catch {
    // fall through
  }
  return new DashboardApiError(response.status, "request_failed", "Request failed");
}

function parseResponse<T>(
  schema: {
    safeParse: (data: unknown) => { success: true; data: T } | { success: false; error: ZodError };
  },
  data: unknown,
  schemaName: string,
  invalidMessage: string,
): T {
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path.join(".") || "(root)";
    if (import.meta.env?.DEV) {
      console.error(`[dashora:api] ${schemaName} validation failed`, {
        schema: schemaName,
        field,
        issueCount: parsed.error.issues.length,
      });
    }
    throw new DashboardApiError(502, "invalid_response", invalidMessage);
  }
  return parsed.data;
}

export type DashboardApi = {
  getDashboard: () => Promise<Dashboard>;
  createPage: (input: CreatePageRequest) => Promise<Page>;
  updatePage: (pageId: string, input: UpdatePageRequest) => Promise<Page>;
  duplicatePage: (pageId: string) => Promise<Page>;
  reorderPages: (orderedIds: string[]) => Promise<Dashboard>;
  deletePage: (pageId: string) => Promise<{ deletedId: string }>;
  getPageLayout: (pageId: string) => Promise<PageLayoutResponse>;
  savePageLayout: (pageId: string, layout: PageLayoutDocument) => Promise<PageLayoutResponse>;
  resetPageLayout: (pageId: string) => Promise<PageLayoutResponse>;
  createPageWidget: (
    pageId: string,
    input: CreatePageWidgetRequest,
  ) => Promise<CreatePageWidgetResponse>;
};

export function createDashboardApi(baseUrl: string): DashboardApi {
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
    async getDashboard() {
      const response = await request("/api/v1/dashboard");
      if (!response.ok) {
        throw await parseError(response);
      }
      return dashboardResponseSchema.parse(await response.json()).dashboard;
    },

    async createPage(input) {
      const response = await mutating("/api/v1/dashboard/pages", "POST", input);
      if (!response.ok) {
        throw await parseError(response);
      }
      return pageResponseSchema.parse(await response.json()).page;
    },

    async updatePage(pageId, input) {
      const response = await mutating(`/api/v1/dashboard/pages/${pageId}`, "PATCH", input);
      if (!response.ok) {
        throw await parseError(response);
      }
      return pageResponseSchema.parse(await response.json()).page;
    },

    async duplicatePage(pageId) {
      const response = await mutating(`/api/v1/dashboard/pages/${pageId}/duplicate`, "POST");
      if (!response.ok) {
        throw await parseError(response);
      }
      return pageResponseSchema.parse(await response.json()).page;
    },

    async reorderPages(orderedIds) {
      const response = await mutating("/api/v1/dashboard/pages/order", "PUT", { orderedIds });
      if (!response.ok) {
        throw await parseError(response);
      }
      return dashboardResponseSchema.parse(await response.json()).dashboard;
    },

    async deletePage(pageId) {
      const response = await mutating(`/api/v1/dashboard/pages/${pageId}`, "DELETE");
      if (!response.ok) {
        throw await parseError(response);
      }
      return deletePageResponseSchema.parse(await response.json());
    },

    async getPageLayout(pageId) {
      const response = await request(`/api/v1/dashboard/pages/${pageId}/layout`);
      if (!response.ok) {
        throw await parseError(response);
      }
      return pageLayoutResponseSchema.parse(await response.json());
    },

    async savePageLayout(pageId, layout) {
      const response = await mutating(`/api/v1/dashboard/pages/${pageId}/layout`, "PUT", {
        layout,
      });
      if (!response.ok) {
        throw await parseError(response);
      }
      return pageLayoutResponseSchema.parse(await response.json());
    },

    async resetPageLayout(pageId) {
      const response = await mutating(`/api/v1/dashboard/pages/${pageId}/layout/reset`, "POST");
      if (!response.ok) {
        throw await parseError(response);
      }
      return pageLayoutResponseSchema.parse(await response.json());
    },

    async createPageWidget(pageId, input) {
      const response = await mutating(`/api/v1/dashboard/pages/${pageId}/widgets`, "POST", input);
      if (!response.ok) {
        throw await parseError(response);
      }
      return parseResponse(
        createPageWidgetResponseSchema,
        await response.json(),
        "createPageWidgetResponseSchema",
        "Dashora could not create this widget because the server returned an invalid response.",
      );
    },
  };
}
