import {
  type CreateTodoItemRequest,
  type ReorderTodoItemsRequest,
  type TodoItem,
  type TodoItemsResponse,
  type UpdateTodoItemRequest,
  createTodoItemRequestSchema,
  reorderTodoItemsRequestSchema,
  todoItemResponseSchema,
  todoItemsResponseSchema,
  updateTodoItemRequestSchema,
} from "./config.js";

export class TodoApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "TodoApiError";
    this.status = status;
    this.code = code;
  }
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
    throw new TodoApiError(response.status, "csrf_failed", "Could not obtain CSRF token");
  }
  const body = (await response.json()) as { csrfToken: string };
  return body.csrfToken;
}

export type TodoClient = {
  list: (instanceId: string) => Promise<TodoItem[]>;
  create: (instanceId: string, input: CreateTodoItemRequest) => Promise<TodoItem>;
  update: (instanceId: string, itemId: string, input: UpdateTodoItemRequest) => Promise<TodoItem>;
  remove: (instanceId: string, itemId: string) => Promise<void>;
  reorder: (instanceId: string, input: ReorderTodoItemsRequest) => Promise<TodoItem[]>;
};

export function createTodoClient(baseUrl = ""): TodoClient {
  const root = baseUrl.replace(/\/$/, "");

  async function request(
    path: string,
    init: RequestInit & { json?: unknown } = {},
  ): Promise<Response> {
    const headers: Record<string, string> = {
      ...(init.headers as Record<string, string> | undefined),
    };
    const { json, body: initBody, ...rest } = init;
    let body: BodyInit | null | undefined = initBody;
    if (json !== undefined) {
      headers["content-type"] = "application/json";
      body = JSON.stringify(json);
    }
    const method = rest.method ?? "GET";
    if (method !== "GET" && method !== "HEAD") {
      headers["x-csrf-token"] = await ensureCsrf(root);
    }
    const requestInit: RequestInit = {
      ...rest,
      method,
      credentials: "include",
      headers,
    };
    if (body !== undefined) {
      requestInit.body = body;
    }
    return fetch(`${root}${path}`, requestInit);
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
    throw new TodoApiError(response.status, code, message);
  }

  return {
    async list(instanceId) {
      const response = await request(`/api/v1/widgets/todo/instances/${instanceId}/items`);
      if (!response.ok) {
        await fail(response);
      }
      const parsed = todoItemsResponseSchema.parse(await response.json()) as TodoItemsResponse;
      return parsed.items;
    },

    async create(instanceId, input) {
      const payload = createTodoItemRequestSchema.parse(input);
      const response = await request(`/api/v1/widgets/todo/instances/${instanceId}/items`, {
        method: "POST",
        json: payload,
      });
      if (!response.ok) {
        await fail(response);
      }
      return todoItemResponseSchema.parse(await response.json()).item;
    },

    async update(instanceId, itemId, input) {
      const payload = updateTodoItemRequestSchema.parse(input);
      const response = await request(
        `/api/v1/widgets/todo/instances/${instanceId}/items/${itemId}`,
        {
          method: "PATCH",
          json: payload,
        },
      );
      if (!response.ok) {
        await fail(response);
      }
      return todoItemResponseSchema.parse(await response.json()).item;
    },

    async remove(instanceId, itemId) {
      const response = await request(
        `/api/v1/widgets/todo/instances/${instanceId}/items/${itemId}`,
        { method: "DELETE" },
      );
      if (!response.ok) {
        await fail(response);
      }
    },

    async reorder(instanceId, input) {
      const payload = reorderTodoItemsRequestSchema.parse(input);
      const response = await request(`/api/v1/widgets/todo/instances/${instanceId}/items/order`, {
        method: "PUT",
        json: payload,
      });
      if (!response.ok) {
        await fail(response);
      }
      return todoItemsResponseSchema.parse(await response.json()).items;
    },
  };
}

export const defaultTodoClient = createTodoClient();
