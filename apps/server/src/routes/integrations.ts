import {
  type CreateGithubIntegrationRequest,
  type CreateIcsBasicAuthIntegrationRequest,
  type UpdateGithubIntegrationRequest,
  type UpdateIcsBasicAuthIntegrationRequest,
  createGithubIntegrationRequestSchema,
  createIcsBasicAuthIntegrationRequestSchema,
  deleteGithubIntegrationResponseSchema,
  deleteIcsBasicAuthIntegrationResponseSchema,
  githubIntegrationResponseSchema,
  githubIntegrationsResponseSchema,
  icsBasicAuthIntegrationResponseSchema,
  icsBasicAuthIntegrationsResponseSchema,
  updateGithubIntegrationRequestSchema,
  updateIcsBasicAuthIntegrationRequestSchema,
} from "@dashora/shared";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { isStateChangingMethod, sendCsrfError, validateCsrf } from "../auth/csrf.js";
import type { SessionService } from "../auth/session-service.js";
import { sendApiError } from "../http/errors.js";
import {
  type GithubIntegrationService,
  GithubIntegrationServiceError,
} from "../services/github-integration-service.js";
import {
  type IcsBasicAuthIntegrationService,
  IcsBasicAuthIntegrationServiceError,
} from "../services/ics-basic-auth-service.js";

export type IntegrationRouteOptions = {
  sessions: SessionService;
  githubIntegrations: GithubIntegrationService;
  icsBasicAuthIntegrations: IcsBasicAuthIntegrationService;
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

function serviceErrorStatus(
  code: GithubIntegrationServiceError["code"] | IcsBasicAuthIntegrationServiceError["code"],
): number {
  switch (code) {
    case "not_found":
      return 404;
    case "validation_error":
      return 400;
    case "encryption_unavailable":
      return 503;
    case "decrypt_failed":
      return 500;
    default:
      return 500;
  }
}

export async function registerIntegrationRoutes(
  app: FastifyInstance,
  options: IntegrationRouteOptions,
): Promise<void> {
  const { sessions, githubIntegrations, icsBasicAuthIntegrations } = options;

  app.get("/api/v1/integrations/github", async (request, reply) => {
    const auth = await sessions.resolveSession(request, reply);
    if (!auth) {
      return sendApiError(reply, 401, "unauthenticated", "Authentication required");
    }
    const integrations = await githubIntegrations.list(auth.user.id);
    return githubIntegrationsResponseSchema.parse({ integrations });
  });

  app.post("/api/v1/integrations/github", async (request, reply) => {
    if (!(await requireCsrf(request, reply))) {
      return;
    }
    const auth = await sessions.resolveSession(request, reply);
    if (!auth) {
      return sendApiError(reply, 401, "unauthenticated", "Authentication required");
    }

    let body: CreateGithubIntegrationRequest;
    try {
      body = createGithubIntegrationRequestSchema.parse(request.body);
    } catch {
      return sendApiError(reply, 400, "validation_error", "Invalid GitHub integration payload");
    }

    try {
      const integration = await githubIntegrations.create(auth.user.id, body);
      return reply.status(201).send(githubIntegrationResponseSchema.parse({ integration }));
    } catch (error) {
      if (error instanceof GithubIntegrationServiceError) {
        return sendApiError(reply, serviceErrorStatus(error.code), error.code, error.message);
      }
      throw error;
    }
  });

  app.patch("/api/v1/integrations/github/:id", async (request, reply) => {
    if (!(await requireCsrf(request, reply))) {
      return;
    }
    const auth = await sessions.resolveSession(request, reply);
    if (!auth) {
      return sendApiError(reply, 401, "unauthenticated", "Authentication required");
    }
    const id = readParam(request.params, "id");
    if (!id) {
      return sendApiError(reply, 400, "validation_error", "Integration id is required");
    }

    let body: UpdateGithubIntegrationRequest;
    try {
      body = updateGithubIntegrationRequestSchema.parse(request.body);
    } catch {
      return sendApiError(reply, 400, "validation_error", "Invalid GitHub integration payload");
    }

    try {
      const integration = await githubIntegrations.update(auth.user.id, id, body);
      return githubIntegrationResponseSchema.parse({ integration });
    } catch (error) {
      if (error instanceof GithubIntegrationServiceError) {
        return sendApiError(reply, serviceErrorStatus(error.code), error.code, error.message);
      }
      throw error;
    }
  });

  app.delete("/api/v1/integrations/github/:id", async (request, reply) => {
    if (!(await requireCsrf(request, reply))) {
      return;
    }
    const auth = await sessions.resolveSession(request, reply);
    if (!auth) {
      return sendApiError(reply, 401, "unauthenticated", "Authentication required");
    }
    const id = readParam(request.params, "id");
    if (!id) {
      return sendApiError(reply, 400, "validation_error", "Integration id is required");
    }

    try {
      await githubIntegrations.remove(auth.user.id, id);
      return deleteGithubIntegrationResponseSchema.parse({ deleted: true });
    } catch (error) {
      if (error instanceof GithubIntegrationServiceError) {
        return sendApiError(reply, serviceErrorStatus(error.code), error.code, error.message);
      }
      throw error;
    }
  });

  app.get("/api/v1/integrations/ics-basic-auth", async (request, reply) => {
    const auth = await sessions.resolveSession(request, reply);
    if (!auth) {
      return sendApiError(reply, 401, "unauthenticated", "Authentication required");
    }
    const integrations = await icsBasicAuthIntegrations.list(auth.user.id);
    return icsBasicAuthIntegrationsResponseSchema.parse({ integrations });
  });

  app.post("/api/v1/integrations/ics-basic-auth", async (request, reply) => {
    if (!(await requireCsrf(request, reply))) {
      return;
    }
    const auth = await sessions.resolveSession(request, reply);
    if (!auth) {
      return sendApiError(reply, 401, "unauthenticated", "Authentication required");
    }

    let body: CreateIcsBasicAuthIntegrationRequest;
    try {
      body = createIcsBasicAuthIntegrationRequestSchema.parse(request.body);
    } catch {
      return sendApiError(
        reply,
        400,
        "validation_error",
        "Invalid ICS basic auth integration payload",
      );
    }

    try {
      const integration = await icsBasicAuthIntegrations.create(auth.user.id, body);
      return reply.status(201).send(icsBasicAuthIntegrationResponseSchema.parse({ integration }));
    } catch (error) {
      if (error instanceof IcsBasicAuthIntegrationServiceError) {
        return sendApiError(reply, serviceErrorStatus(error.code), error.code, error.message);
      }
      throw error;
    }
  });

  app.patch("/api/v1/integrations/ics-basic-auth/:id", async (request, reply) => {
    if (!(await requireCsrf(request, reply))) {
      return;
    }
    const auth = await sessions.resolveSession(request, reply);
    if (!auth) {
      return sendApiError(reply, 401, "unauthenticated", "Authentication required");
    }
    const id = readParam(request.params, "id");
    if (!id) {
      return sendApiError(reply, 400, "validation_error", "Integration id is required");
    }

    let body: UpdateIcsBasicAuthIntegrationRequest;
    try {
      body = updateIcsBasicAuthIntegrationRequestSchema.parse(request.body);
    } catch {
      return sendApiError(
        reply,
        400,
        "validation_error",
        "Invalid ICS basic auth integration payload",
      );
    }

    try {
      const integration = await icsBasicAuthIntegrations.update(auth.user.id, id, body);
      return icsBasicAuthIntegrationResponseSchema.parse({ integration });
    } catch (error) {
      if (error instanceof IcsBasicAuthIntegrationServiceError) {
        return sendApiError(reply, serviceErrorStatus(error.code), error.code, error.message);
      }
      throw error;
    }
  });

  app.delete("/api/v1/integrations/ics-basic-auth/:id", async (request, reply) => {
    if (!(await requireCsrf(request, reply))) {
      return;
    }
    const auth = await sessions.resolveSession(request, reply);
    if (!auth) {
      return sendApiError(reply, 401, "unauthenticated", "Authentication required");
    }
    const id = readParam(request.params, "id");
    if (!id) {
      return sendApiError(reply, 400, "validation_error", "Integration id is required");
    }

    try {
      await icsBasicAuthIntegrations.remove(auth.user.id, id);
      return deleteIcsBasicAuthIntegrationResponseSchema.parse({ deleted: true });
    } catch (error) {
      if (error instanceof IcsBasicAuthIntegrationServiceError) {
        return sendApiError(reply, serviceErrorStatus(error.code), error.code, error.message);
      }
      throw error;
    }
  });
}
