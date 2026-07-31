import {
  resetThemePreferencesResponseSchema,
  themePreferencesResponseSchema,
  updateThemePreferencesRequestSchema,
} from "@dashora/shared";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { isStateChangingMethod, sendCsrfError, validateCsrf } from "../auth/csrf.js";
import type { SessionService } from "../auth/session-service.js";
import { sendApiError } from "../http/errors.js";
import type { AuditService } from "../services/audit-service.js";
import type { ThemeSettingsService } from "../services/theme-settings-service.js";

export type SettingsRouteOptions = {
  sessions: SessionService;
  themeSettings: ThemeSettingsService;
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

export async function registerSettingsRoutes(
  app: FastifyInstance,
  options: SettingsRouteOptions,
): Promise<void> {
  const { sessions, themeSettings, audit } = options;

  app.get("/api/v1/settings/theme", async (request, reply) => {
    const auth = await sessions.resolveSession(request, reply);
    if (!auth) {
      return sendApiError(reply, 401, "unauthenticated", "Authentication required");
    }
    const preferences = await themeSettings.getPreferences(auth.user.id);
    return themePreferencesResponseSchema.parse({ preferences });
  });

  app.put("/api/v1/settings/theme", async (request, reply) => {
    if (!(await requireCsrf(request, reply))) {
      return;
    }
    const auth = await sessions.resolveSession(request, reply);
    if (!auth) {
      return sendApiError(reply, 401, "unauthenticated", "Authentication required");
    }

    const parsed = updateThemePreferencesRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return sendApiError(reply, 400, "validation_error", "Invalid theme preferences");
    }

    const preferences = await themeSettings.updatePreferences(auth.user.id, parsed.data);
    await recordAudit(app, audit, {
      event: "settings.theme.updated",
      success: true,
      actorUserId: auth.user.id,
      actorEmail: auth.user.email,
      ip: request.ip,
    });
    return themePreferencesResponseSchema.parse({ preferences });
  });

  app.post("/api/v1/settings/theme/reset", async (request, reply) => {
    if (!(await requireCsrf(request, reply))) {
      return;
    }
    const auth = await sessions.resolveSession(request, reply);
    if (!auth) {
      return sendApiError(reply, 401, "unauthenticated", "Authentication required");
    }

    const preferences = await themeSettings.resetPreferences(auth.user.id);
    await recordAudit(app, audit, {
      event: "settings.theme.reset",
      success: true,
      actorUserId: auth.user.id,
      actorEmail: auth.user.email,
      ip: request.ip,
    });
    return resetThemePreferencesResponseSchema.parse({ preferences });
  });
}
