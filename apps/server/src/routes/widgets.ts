import {
  createWidgetDataResponse,
  createWidgetServerRegistry,
  toServerRegistration,
  widgetDataResponseSchema,
} from "@dashora/widget-sdk";
import {
  demoMetricsDefinition,
  demoMetricsProvider,
} from "@dashora/widget-sdk/examples/demo-metrics/server";
import {
  bookmarksDefinition,
  bookmarksProvider,
} from "@dashora/widget-sdk/widgets/bookmarks/server";
import { clockDefinition, clockProvider } from "@dashora/widget-sdk/widgets/clock/server";
import { searchDefinition, searchProvider } from "@dashora/widget-sdk/widgets/search/server";
import {
  todoItemResponseSchema,
  todoItemsResponseSchema,
} from "@dashora/widget-sdk/widgets/todo/server";
import { createTodoProvider, todoDefinition } from "@dashora/widget-sdk/widgets/todo/server";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { isStateChangingMethod, sendCsrfError, validateCsrf } from "../auth/csrf.js";
import type { SessionService } from "../auth/session-service.js";
import { sendApiError } from "../http/errors.js";
import { type TodoService, TodoServiceError } from "../services/todo-service.js";

export type WidgetRouteOptions = {
  sessions: SessionService;
  todos: TodoService;
};

async function requireCsrf(request: FastifyRequest, reply: FastifyReply): Promise<boolean> {
  if (!isStateChangingMethod(request.method)) {
    return true;
  }
  if (!validateCsrf(request)) {
    await sendCsrfError(reply);
    return false;
  }
  return true;
}

function readParam(params: unknown, key: string): string | null {
  if (typeof params !== "object" || params === null || !(key in params)) {
    return null;
  }
  const value = (params as Record<string, unknown>)[key];
  return typeof value === "string" ? value : null;
}

function todoErrorStatus(code: TodoServiceError["code"]): number {
  switch (code) {
    case "not_found":
      return 404;
    case "invalid_order":
    case "validation_error":
      return 400;
    default:
      return 500;
  }
}

export async function registerWidgetRoutes(
  app: FastifyInstance,
  options: WidgetRouteOptions,
): Promise<void> {
  const { sessions, todos } = options;

  const serverRegistry = createWidgetServerRegistry([
    toServerRegistration(searchDefinition, searchProvider),
    toServerRegistration(clockDefinition, clockProvider),
    toServerRegistration(bookmarksDefinition, bookmarksProvider),
    toServerRegistration(
      todoDefinition,
      createTodoProvider({
        listByInstance: async () => [],
      }),
    ),
    toServerRegistration(demoMetricsDefinition, demoMetricsProvider),
  ]);

  app.get("/api/v1/widgets/:widgetType/instances/:instanceId/data", async (request, reply) => {
    const auth = await sessions.resolveSession(request, reply);
    if (!auth) {
      return sendApiError(reply, 401, "unauthenticated", "Authentication required");
    }

    const widgetType = readParam(request.params, "widgetType");
    const instanceId = readParam(request.params, "instanceId");
    if (!widgetType || !instanceId) {
      return sendApiError(
        reply,
        400,
        "validation_error",
        "Widget type and instance id are required",
      );
    }

    if (!serverRegistry.has(widgetType)) {
      return sendApiError(reply, 404, "not_found", `Unknown widget type “${widgetType}”`);
    }

    const definition = serverRegistry.requireDefinition(widgetType);
    const provider = serverRegistry.requireProvider(widgetType);

    const query = request.query as { config?: string };
    let config: unknown = {};
    if (typeof query.config === "string" && query.config.length > 0) {
      try {
        config = JSON.parse(query.config) as unknown;
      } catch {
        return sendApiError(reply, 400, "validation_error", "Invalid config query JSON");
      }
    }

    let parsedConfig: unknown;
    try {
      parsedConfig = serverRegistry.parseConfig(widgetType, config, definition.schemaVersion);
    } catch {
      return sendApiError(reply, 400, "validation_error", "Invalid widget configuration");
    }

    if (widgetType === "todo") {
      const items = await todos.list(auth.user.id, instanceId);
      const todoConfig = parsedConfig as {
        viewMode: "compact" | "detailed";
        showCompleted: boolean;
        enabled: boolean;
      };
      if (!todoConfig.enabled) {
        return widgetDataResponseSchema.parse(
          createWidgetDataResponse({
            widgetId: todoDefinition.id,
            instanceId,
            state: "disabled",
            message: "Todo is disabled in settings.",
            meta: {
              fetchedAt: new Date().toISOString(),
              cache: "miss",
              schemaVersion: todoDefinition.schemaVersion,
              widgetVersion: todoDefinition.version,
            },
          }),
        );
      }
      const data = {
        items,
        viewMode: todoConfig.viewMode,
        showCompleted: todoConfig.showCompleted,
      };
      return widgetDataResponseSchema.parse(
        createWidgetDataResponse({
          widgetId: todoDefinition.id,
          instanceId,
          state: items.length === 0 ? "empty" : "success",
          data,
          ...(items.length === 0
            ? { message: "Your completed and upcoming tasks will appear here." }
            : {}),
          meta: {
            fetchedAt: new Date().toISOString(),
            cache: "miss",
            schemaVersion: todoDefinition.schemaVersion,
            widgetVersion: todoDefinition.version,
          },
        }),
      );
    }

    const result = await provider.fetch({
      instanceId,
      config: parsedConfig,
    });

    return widgetDataResponseSchema.parse(
      createWidgetDataResponse({
        widgetId: definition.id,
        instanceId,
        state: result.state,
        ...(result.data !== undefined ? { data: result.data } : {}),
        ...(result.message !== undefined ? { message: result.message } : {}),
        ...(result.errorCode !== undefined ? { errorCode: result.errorCode } : {}),
        meta: {
          fetchedAt: new Date().toISOString(),
          cache: result.cacheStatus ?? "miss",
          schemaVersion: definition.schemaVersion,
          widgetVersion: definition.version,
        },
      }),
    );
  });

  app.get("/api/v1/widgets/todo/instances/:instanceId/items", async (request, reply) => {
    const auth = await sessions.resolveSession(request, reply);
    if (!auth) {
      return sendApiError(reply, 401, "unauthenticated", "Authentication required");
    }
    const instanceId = readParam(request.params, "instanceId");
    if (!instanceId) {
      return sendApiError(reply, 400, "validation_error", "Instance id is required");
    }
    try {
      const items = await todos.list(auth.user.id, instanceId);
      return todoItemsResponseSchema.parse({ items });
    } catch (error) {
      if (error instanceof TodoServiceError) {
        return sendApiError(reply, todoErrorStatus(error.code), error.code, error.message);
      }
      throw error;
    }
  });

  app.post("/api/v1/widgets/todo/instances/:instanceId/items", async (request, reply) => {
    if (!(await requireCsrf(request, reply))) {
      return;
    }
    const auth = await sessions.resolveSession(request, reply);
    if (!auth) {
      return sendApiError(reply, 401, "unauthenticated", "Authentication required");
    }
    const instanceId = readParam(request.params, "instanceId");
    if (!instanceId) {
      return sendApiError(reply, 400, "validation_error", "Instance id is required");
    }
    try {
      const item = await todos.create(auth.user.id, instanceId, request.body);
      return reply.status(201).send(todoItemResponseSchema.parse({ item }));
    } catch (error) {
      if (error instanceof TodoServiceError) {
        return sendApiError(reply, todoErrorStatus(error.code), error.code, error.message);
      }
      throw error;
    }
  });

  app.patch("/api/v1/widgets/todo/instances/:instanceId/items/:itemId", async (request, reply) => {
    if (!(await requireCsrf(request, reply))) {
      return;
    }
    const auth = await sessions.resolveSession(request, reply);
    if (!auth) {
      return sendApiError(reply, 401, "unauthenticated", "Authentication required");
    }
    const instanceId = readParam(request.params, "instanceId");
    const itemId = readParam(request.params, "itemId");
    if (!instanceId || !itemId) {
      return sendApiError(reply, 400, "validation_error", "Instance id and item id are required");
    }
    try {
      const item = await todos.update(auth.user.id, instanceId, itemId, request.body);
      return todoItemResponseSchema.parse({ item });
    } catch (error) {
      if (error instanceof TodoServiceError) {
        return sendApiError(reply, todoErrorStatus(error.code), error.code, error.message);
      }
      throw error;
    }
  });

  app.delete("/api/v1/widgets/todo/instances/:instanceId/items/:itemId", async (request, reply) => {
    if (!(await requireCsrf(request, reply))) {
      return;
    }
    const auth = await sessions.resolveSession(request, reply);
    if (!auth) {
      return sendApiError(reply, 401, "unauthenticated", "Authentication required");
    }
    const instanceId = readParam(request.params, "instanceId");
    const itemId = readParam(request.params, "itemId");
    if (!instanceId || !itemId) {
      return sendApiError(reply, 400, "validation_error", "Instance id and item id are required");
    }
    try {
      await todos.remove(auth.user.id, instanceId, itemId);
      return reply.status(204).send();
    } catch (error) {
      if (error instanceof TodoServiceError) {
        return sendApiError(reply, todoErrorStatus(error.code), error.code, error.message);
      }
      throw error;
    }
  });

  app.put("/api/v1/widgets/todo/instances/:instanceId/items/order", async (request, reply) => {
    if (!(await requireCsrf(request, reply))) {
      return;
    }
    const auth = await sessions.resolveSession(request, reply);
    if (!auth) {
      return sendApiError(reply, 401, "unauthenticated", "Authentication required");
    }
    const instanceId = readParam(request.params, "instanceId");
    if (!instanceId) {
      return sendApiError(reply, 400, "validation_error", "Instance id is required");
    }
    try {
      const items = await todos.reorder(auth.user.id, instanceId, request.body);
      return todoItemsResponseSchema.parse({ items });
    } catch (error) {
      if (error instanceof TodoServiceError) {
        return sendApiError(reply, todoErrorStatus(error.code), error.code, error.message);
      }
      throw error;
    }
  });
}
