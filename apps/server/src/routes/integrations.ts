import {
  type CreateApiSecretIntegrationRequest,
  type CreateGithubIntegrationRequest,
  type CreateIcsBasicAuthIntegrationRequest,
  type UpdateApiSecretIntegrationRequest,
  type UpdateGithubIntegrationRequest,
  type UpdateIcsBasicAuthIntegrationRequest,
  apiSecretIntegrationResponseSchema,
  apiSecretIntegrationsResponseSchema,
  createApiSecretIntegrationRequestSchema,
  createGithubIntegrationRequestSchema,
  createIcsBasicAuthIntegrationRequestSchema,
  deleteApiSecretIntegrationResponseSchema,
  deleteGithubIntegrationResponseSchema,
  deleteIcsBasicAuthIntegrationResponseSchema,
  githubIntegrationResponseSchema,
  githubIntegrationsResponseSchema,
  icsBasicAuthIntegrationResponseSchema,
  icsBasicAuthIntegrationsResponseSchema,
  updateApiSecretIntegrationRequestSchema,
  updateGithubIntegrationRequestSchema,
  updateIcsBasicAuthIntegrationRequestSchema,
} from "@dashora/shared";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { isStateChangingMethod, sendCsrfError, validateCsrf } from "../auth/csrf.js";
import type { SessionService } from "../auth/session-service.js";
import { sendApiError } from "../http/errors.js";
import { type ApiSecretService, ApiSecretServiceError } from "../services/api-secret-service.js";
import type { AuditService } from "../services/audit-service.js";
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
  apiSecrets: ApiSecretService;
  audit: AuditService;
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
  code:
    | GithubIntegrationServiceError["code"]
    | IcsBasicAuthIntegrationServiceError["code"]
    | ApiSecretServiceError["code"],
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

/** Audit writes must never break the request they observe — log and continue on failure. */
async function recordAudit(
  app: FastifyInstance,
  audit: AuditService,
  input: Parameters<AuditService["record"]>[0],
): Promise<void> {
  try {
    await audit.record(input);
  } catch (error) {
    app.log.error({ err: error }, "Failed to record audit event");
  }
}

export async function registerIntegrationRoutes(
  app: FastifyInstance,
  options: IntegrationRouteOptions,
): Promise<void> {
  const { sessions, githubIntegrations, icsBasicAuthIntegrations, apiSecrets, audit } = options;

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
      await recordAudit(app, audit, {
        event: "integration.github.created",
        success: true,
        actorUserId: auth.user.id,
        actorEmail: auth.user.email,
        ip: request.ip,
        metadata: { integrationId: integration.id, name: integration.name },
      });
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
      await recordAudit(app, audit, {
        event: "integration.github.updated",
        success: true,
        actorUserId: auth.user.id,
        actorEmail: auth.user.email,
        ip: request.ip,
        metadata: { integrationId: integration.id, name: integration.name },
      });
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
      await recordAudit(app, audit, {
        event: "integration.github.deleted",
        success: true,
        actorUserId: auth.user.id,
        actorEmail: auth.user.email,
        ip: request.ip,
        metadata: { integrationId: id },
      });
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
      await recordAudit(app, audit, {
        event: "integration.ics_basic_auth.created",
        success: true,
        actorUserId: auth.user.id,
        actorEmail: auth.user.email,
        ip: request.ip,
        metadata: { integrationId: integration.id, name: integration.name },
      });
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
      await recordAudit(app, audit, {
        event: "integration.ics_basic_auth.updated",
        success: true,
        actorUserId: auth.user.id,
        actorEmail: auth.user.email,
        ip: request.ip,
        metadata: { integrationId: integration.id, name: integration.name },
      });
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
      await recordAudit(app, audit, {
        event: "integration.ics_basic_auth.deleted",
        success: true,
        actorUserId: auth.user.id,
        actorEmail: auth.user.email,
        ip: request.ip,
        metadata: { integrationId: id },
      });
      return deleteIcsBasicAuthIntegrationResponseSchema.parse({ deleted: true });
    } catch (error) {
      if (error instanceof IcsBasicAuthIntegrationServiceError) {
        return sendApiError(reply, serviceErrorStatus(error.code), error.code, error.message);
      }
      throw error;
    }
  });

  app.get("/api/v1/integrations/api-secret", async (request, reply) => {
    const auth = await sessions.resolveSession(request, reply);
    if (!auth) {
      return sendApiError(reply, 401, "unauthenticated", "Authentication required");
    }
    const integrations = await apiSecrets.list(auth.user.id);
    return apiSecretIntegrationsResponseSchema.parse({ integrations });
  });

  app.post("/api/v1/integrations/api-secret", async (request, reply) => {
    if (!(await requireCsrf(request, reply))) {
      return;
    }
    const auth = await sessions.resolveSession(request, reply);
    if (!auth) {
      return sendApiError(reply, 401, "unauthenticated", "Authentication required");
    }
    const parsed = createApiSecretIntegrationRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return sendApiError(reply, 400, "validation_error", "Invalid API secret payload");
    }
    try {
      const integration = await apiSecrets.create(
        auth.user.id,
        parsed.data as CreateApiSecretIntegrationRequest,
      );
      await recordAudit(app, audit, {
        event: "integration.api_secret.created",
        success: true,
        actorUserId: auth.user.id,
        actorEmail: auth.user.email,
        ip: request.ip,
        metadata: { integrationId: integration.id, name: integration.name },
      });
      return reply.status(201).send(apiSecretIntegrationResponseSchema.parse({ integration }));
    } catch (error) {
      if (error instanceof ApiSecretServiceError) {
        return sendApiError(reply, serviceErrorStatus(error.code), error.code, error.message);
      }
      throw error;
    }
  });

  app.patch("/api/v1/integrations/api-secret/:id", async (request, reply) => {
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
    const parsed = updateApiSecretIntegrationRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return sendApiError(reply, 400, "validation_error", "Invalid API secret update payload");
    }
    try {
      const integration = await apiSecrets.update(
        auth.user.id,
        id,
        parsed.data as UpdateApiSecretIntegrationRequest,
      );
      await recordAudit(app, audit, {
        event: "integration.api_secret.updated",
        success: true,
        actorUserId: auth.user.id,
        actorEmail: auth.user.email,
        ip: request.ip,
        metadata: { integrationId: integration.id, name: integration.name },
      });
      return apiSecretIntegrationResponseSchema.parse({ integration });
    } catch (error) {
      if (error instanceof ApiSecretServiceError) {
        return sendApiError(reply, serviceErrorStatus(error.code), error.code, error.message);
      }
      throw error;
    }
  });

  app.delete("/api/v1/integrations/api-secret/:id", async (request, reply) => {
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
      await apiSecrets.remove(auth.user.id, id);
      await recordAudit(app, audit, {
        event: "integration.api_secret.deleted",
        success: true,
        actorUserId: auth.user.id,
        actorEmail: auth.user.email,
        ip: request.ip,
        metadata: { integrationId: id },
      });
      return deleteApiSecretIntegrationResponseSchema.parse({ deleted: true });
    } catch (error) {
      if (error instanceof ApiSecretServiceError) {
        return sendApiError(reply, serviceErrorStatus(error.code), error.code, error.message);
      }
      throw error;
    }
  });
}
