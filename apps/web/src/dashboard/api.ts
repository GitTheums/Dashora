import {
  type CreatePageRequest,
  type Dashboard,
  type Page,
  type PageLayoutDocument,
  type PageLayoutResponse,
  type UpdatePageRequest,
  apiErrorSchema,
  dashboardResponseSchema,
  deletePageResponseSchema,
  pageLayoutResponseSchema,
  pageResponseSchema,
} from "@dashora/shared";

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
  };
}
