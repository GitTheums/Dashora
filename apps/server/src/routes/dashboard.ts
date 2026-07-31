import {
  createPageRequestSchema,
  createPageWidgetRequestSchema,
  createPageWidgetResponseSchema,
  dashboardResponseSchema,
  dashboardThemeResponseSchema,
  deletePageResponseSchema,
  pageLayoutResponseSchema,
  pageResponseSchema,
  reorderPagesRequestSchema,
  savePageLayoutRequestSchema,
  updateDashboardThemeRequestSchema,
  updatePageRequestSchema,
} from "@dashora/shared";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { isStateChangingMethod, sendCsrfError, validateCsrf } from "../auth/csrf.js";
import type { SessionService } from "../auth/session-service.js";
import { sendApiError } from "../http/errors.js";
import { type DashboardService, DashboardServiceError } from "../services/dashboard-service.js";

export type DashboardRouteOptions = {
  sessions: SessionService;
  dashboards: DashboardService;
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

function serviceErrorStatus(code: DashboardServiceError["code"]): number {
  switch (code) {
    case "not_found":
      return 404;
    case "slug_conflict":
    case "last_page":
      return 409;
    case "invalid_order":
      return 400;
    case "forbidden":
      return 403;
    default:
      return 500;
  }
}

export async function registerDashboardRoutes(
  app: FastifyInstance,
  options: DashboardRouteOptions,
): Promise<void> {
  const { sessions, dashboards } = options;

  app.get("/api/v1/dashboard", async (request, reply) => {
    const auth = await sessions.resolveSession(request, reply);
    if (!auth) {
      return sendApiError(reply, 401, "unauthenticated", "Authentication required");
    }
    const dashboard = await dashboards.getOrCreateDefaultDashboard(auth.user.id);
    return dashboardResponseSchema.parse({ dashboard });
  });

  app.patch("/api/v1/dashboard/theme", async (request, reply) => {
    if (!(await requireCsrf(request, reply))) {
      return;
    }
    const auth = await sessions.resolveSession(request, reply);
    if (!auth) {
      return sendApiError(reply, 401, "unauthenticated", "Authentication required");
    }

    const parsed = updateDashboardThemeRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return sendApiError(reply, 400, "validation_error", "Invalid dashboard theme payload");
    }

    try {
      const themeOverride = await dashboards.updateThemeOverride(
        auth.user.id,
        parsed.data.themeOverride,
      );
      return dashboardThemeResponseSchema.parse({ themeOverride });
    } catch (error) {
      if (error instanceof DashboardServiceError) {
        return sendApiError(reply, serviceErrorStatus(error.code), error.code, error.message);
      }
      throw error;
    }
  });

  app.post("/api/v1/dashboard/pages", async (request, reply) => {
    if (!(await requireCsrf(request, reply))) {
      return;
    }
    const auth = await sessions.resolveSession(request, reply);
    if (!auth) {
      return sendApiError(reply, 401, "unauthenticated", "Authentication required");
    }

    const parsed = createPageRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return sendApiError(reply, 400, "validation_error", "Invalid page payload");
    }

    try {
      const page = await dashboards.createPage(auth.user.id, {
        name: parsed.data.name,
        slug: parsed.data.slug,
        icon: parsed.data.icon,
        accent: parsed.data.accent ?? null,
      });
      return reply.status(201).send(pageResponseSchema.parse({ page }));
    } catch (error) {
      if (error instanceof DashboardServiceError) {
        return sendApiError(reply, serviceErrorStatus(error.code), error.code, error.message);
      }
      throw error;
    }
  });

  app.patch("/api/v1/dashboard/pages/:pageId", async (request, reply) => {
    if (!(await requireCsrf(request, reply))) {
      return;
    }
    const auth = await sessions.resolveSession(request, reply);
    if (!auth) {
      return sendApiError(reply, 401, "unauthenticated", "Authentication required");
    }

    const pageId =
      typeof request.params === "object" &&
      request.params !== null &&
      "pageId" in request.params &&
      typeof (request.params as { pageId: unknown }).pageId === "string"
        ? (request.params as { pageId: string }).pageId
        : null;
    if (!pageId) {
      return sendApiError(reply, 400, "validation_error", "Page id is required");
    }

    const parsed = updatePageRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return sendApiError(reply, 400, "validation_error", "Invalid page payload");
    }

    try {
      const page = await dashboards.updatePage(auth.user.id, pageId, {
        ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
        ...(parsed.data.slug !== undefined ? { slug: parsed.data.slug } : {}),
        ...(parsed.data.icon !== undefined ? { icon: parsed.data.icon } : {}),
        ...(parsed.data.accent !== undefined ? { accent: parsed.data.accent } : {}),
      });
      return pageResponseSchema.parse({ page });
    } catch (error) {
      if (error instanceof DashboardServiceError) {
        return sendApiError(reply, serviceErrorStatus(error.code), error.code, error.message);
      }
      throw error;
    }
  });

  app.put("/api/v1/dashboard/pages/order", async (request, reply) => {
    if (!(await requireCsrf(request, reply))) {
      return;
    }
    const auth = await sessions.resolveSession(request, reply);
    if (!auth) {
      return sendApiError(reply, 401, "unauthenticated", "Authentication required");
    }

    const parsed = reorderPagesRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return sendApiError(reply, 400, "validation_error", "Invalid reorder payload");
    }

    try {
      const pages = await dashboards.reorderPages(auth.user.id, parsed.data.orderedIds);
      const dashboard = await dashboards.getOrCreateDefaultDashboard(auth.user.id);
      return dashboardResponseSchema.parse({
        dashboard: {
          ...dashboard,
          pages,
        },
      });
    } catch (error) {
      if (error instanceof DashboardServiceError) {
        return sendApiError(reply, serviceErrorStatus(error.code), error.code, error.message);
      }
      throw error;
    }
  });

  app.post("/api/v1/dashboard/pages/:pageId/duplicate", async (request, reply) => {
    if (!(await requireCsrf(request, reply))) {
      return;
    }
    const auth = await sessions.resolveSession(request, reply);
    if (!auth) {
      return sendApiError(reply, 401, "unauthenticated", "Authentication required");
    }

    const pageId =
      typeof request.params === "object" &&
      request.params !== null &&
      "pageId" in request.params &&
      typeof (request.params as { pageId: unknown }).pageId === "string"
        ? (request.params as { pageId: string }).pageId
        : null;
    if (!pageId) {
      return sendApiError(reply, 400, "validation_error", "Page id is required");
    }

    try {
      const page = await dashboards.duplicatePage(auth.user.id, pageId);
      return reply.status(201).send(pageResponseSchema.parse({ page }));
    } catch (error) {
      if (error instanceof DashboardServiceError) {
        return sendApiError(reply, serviceErrorStatus(error.code), error.code, error.message);
      }
      throw error;
    }
  });

  app.delete("/api/v1/dashboard/pages/:pageId", async (request, reply) => {
    if (!(await requireCsrf(request, reply))) {
      return;
    }
    const auth = await sessions.resolveSession(request, reply);
    if (!auth) {
      return sendApiError(reply, 401, "unauthenticated", "Authentication required");
    }

    const pageId =
      typeof request.params === "object" &&
      request.params !== null &&
      "pageId" in request.params &&
      typeof (request.params as { pageId: unknown }).pageId === "string"
        ? (request.params as { pageId: string }).pageId
        : null;
    if (!pageId) {
      return sendApiError(reply, 400, "validation_error", "Page id is required");
    }

    try {
      const result = await dashboards.deletePage(auth.user.id, pageId);
      return deletePageResponseSchema.parse({ ok: true, deletedId: result.deletedId });
    } catch (error) {
      if (error instanceof DashboardServiceError) {
        return sendApiError(reply, serviceErrorStatus(error.code), error.code, error.message);
      }
      throw error;
    }
  });

  app.get("/api/v1/dashboard/pages/:pageId/layout", async (request, reply) => {
    const auth = await sessions.resolveSession(request, reply);
    if (!auth) {
      return sendApiError(reply, 401, "unauthenticated", "Authentication required");
    }

    const pageId = readPageId(request);
    if (!pageId) {
      return sendApiError(reply, 400, "validation_error", "Page id is required");
    }

    try {
      const layout = await dashboards.getPageLayout(auth.user.id, pageId);
      return pageLayoutResponseSchema.parse(layout);
    } catch (error) {
      if (error instanceof DashboardServiceError) {
        return sendApiError(reply, serviceErrorStatus(error.code), error.code, error.message);
      }
      throw error;
    }
  });

  app.put("/api/v1/dashboard/pages/:pageId/layout", async (request, reply) => {
    if (!(await requireCsrf(request, reply))) {
      return;
    }
    const auth = await sessions.resolveSession(request, reply);
    if (!auth) {
      return sendApiError(reply, 401, "unauthenticated", "Authentication required");
    }

    const pageId = readPageId(request);
    if (!pageId) {
      return sendApiError(reply, 400, "validation_error", "Page id is required");
    }

    const parsed = savePageLayoutRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return sendApiError(reply, 400, "validation_error", "Invalid layout payload");
    }

    try {
      const layout = await dashboards.savePageLayout(auth.user.id, pageId, parsed.data.layout);
      return pageLayoutResponseSchema.parse(layout);
    } catch (error) {
      if (error instanceof DashboardServiceError) {
        return sendApiError(reply, serviceErrorStatus(error.code), error.code, error.message);
      }
      throw error;
    }
  });

  app.post("/api/v1/dashboard/pages/:pageId/widgets", async (request, reply) => {
    if (!(await requireCsrf(request, reply))) {
      return;
    }
    const auth = await sessions.resolveSession(request, reply);
    if (!auth) {
      return sendApiError(reply, 401, "unauthenticated", "Authentication required");
    }

    const pageId = readPageId(request);
    if (!pageId) {
      return sendApiError(reply, 400, "validation_error", "Page id is required");
    }

    const parsed = createPageWidgetRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return sendApiError(reply, 400, "validation_error", "Invalid widget creation payload");
    }

    try {
      const created = await dashboards.createWidget(auth.user.id, pageId, parsed.data);
      return reply.status(201).send(createPageWidgetResponseSchema.parse(created));
    } catch (error) {
      if (error instanceof DashboardServiceError) {
        return sendApiError(reply, serviceErrorStatus(error.code), error.code, error.message);
      }
      throw error;
    }
  });

  app.post("/api/v1/dashboard/pages/:pageId/layout/reset", async (request, reply) => {
    if (!(await requireCsrf(request, reply))) {
      return;
    }
    const auth = await sessions.resolveSession(request, reply);
    if (!auth) {
      return sendApiError(reply, 401, "unauthenticated", "Authentication required");
    }

    const pageId = readPageId(request);
    if (!pageId) {
      return sendApiError(reply, 400, "validation_error", "Page id is required");
    }

    try {
      const layout = await dashboards.resetPageLayout(auth.user.id, pageId);
      return pageLayoutResponseSchema.parse(layout);
    } catch (error) {
      if (error instanceof DashboardServiceError) {
        return sendApiError(reply, serviceErrorStatus(error.code), error.code, error.message);
      }
      throw error;
    }
  });
}

function readPageId(request: FastifyRequest): string | null {
  if (
    typeof request.params === "object" &&
    request.params !== null &&
    "pageId" in request.params &&
    typeof (request.params as { pageId: unknown }).pageId === "string"
  ) {
    return (request.params as { pageId: string }).pageId;
  }
  return null;
}
