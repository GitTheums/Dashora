import {
  authCsrfResponseSchema,
  authMeResponseSchema,
  authStatusResponseSchema,
  loginRequestSchema,
  loginResponseSchema,
  logoutResponseSchema,
  setupRequestSchema,
  setupResponseSchema,
  setupStatusResponseSchema,
} from "@dashora/shared";
import rateLimit from "@fastify/rate-limit";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { CSRF_COOKIE_NAME, SESSION_COOKIE_NAME } from "../auth/cookies.js";
import { isStateChangingMethod, sendCsrfError, validateCsrf } from "../auth/csrf.js";
import { DUMMY_PASSWORD_HASH, verifyPassword } from "../auth/password.js";
import type { SessionService } from "../auth/session-service.js";
import {
  SETUP_ERROR_MESSAGES,
  type SetupService,
  type SetupTokenFailureReason,
} from "../auth/setup-service.js";
import { hashToken } from "../auth/tokens.js";
import { toAuthUser } from "../auth/user-mapper.js";
import type { Repositories } from "../db/repositories/index.js";
import { sendApiError } from "../http/errors.js";
import type { AuditService } from "../services/audit-service.js";
import type { DashboardService } from "../services/dashboard-service.js";

export type AuthRouteOptions = {
  repos: Repositories;
  sessions: SessionService;
  setup: SetupService;
  dashboards: DashboardService;
  audit: AuditService;
  loginRateLimitMax: number;
  loginRateLimitWindowMs: number;
  setupRateLimitMax: number;
  setupRateLimitWindowMs: number;
  nodeEnv: "development" | "test" | "production";
};

const SETUP_COMPLETE_PATH = "/api/v1/setup/complete";

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

function setupFailureStatus(reason: SetupTokenFailureReason): number {
  switch (reason) {
    case "missing_token":
    case "validation_error":
      return 400;
    case "invalid_token":
    case "expired_token":
      return 403;
    case "setup_already_completed":
      return 409;
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

function logSetupDiagnostics(
  app: FastifyInstance,
  nodeEnv: AuthRouteOptions["nodeEnv"],
  payload: Record<string, unknown>,
  message: string,
): void {
  if (nodeEnv !== "development") {
    return;
  }
  app.log.info(payload, message);
}

export async function registerAuthRoutes(
  app: FastifyInstance,
  options: AuthRouteOptions,
): Promise<void> {
  const { repos, sessions, setup, dashboards, audit } = options;

  async function setupStatusHandler() {
    const setupRequired = await setup.isSetupRequired();
    return setupStatusResponseSchema.parse({ setupRequired });
  }

  app.get("/api/v1/setup/status", async () => setupStatusHandler());
  // Compatibility alias used by the session probe / auth gate.
  app.get("/api/v1/auth/status", async () => {
    const body = await setupStatusHandler();
    return authStatusResponseSchema.parse(body);
  });

  app.get("/api/v1/auth/csrf", async (request, reply) => {
    const existing = request.cookies[CSRF_COOKIE_NAME];
    const csrfToken = sessions.issueCsrfCookie(reply, existing);
    return authCsrfResponseSchema.parse({ csrfToken });
  });

  app.get("/api/v1/auth/me", async (request, reply) => {
    const auth = await sessions.resolveSession(request, reply);
    if (!auth) {
      return sendApiError(reply, 401, "unauthenticated", "Authentication required");
    }
    return authMeResponseSchema.parse({
      user: toAuthUser(auth.user),
    });
  });

  await app.register(async (loginScope) => {
    await loginScope.register(rateLimit, {
      max: options.loginRateLimitMax,
      timeWindow: options.loginRateLimitWindowMs,
      hook: "preHandler",
      errorResponseBuilder: () => ({
        error: {
          code: "rate_limited",
          message: "Too many login attempts. Try again later.",
        },
      }),
    });

    loginScope.post("/api/v1/auth/login", async (request, reply) => {
      if (!(await requireCsrf(request, reply))) {
        return;
      }

      const parsed = loginRequestSchema.safeParse(request.body);
      if (!parsed.success) {
        return sendApiError(reply, 400, "validation_error", "Invalid login payload");
      }

      const user = await repos.users.findByEmail(parsed.data.email);
      const passwordOk = await verifyPassword(
        user?.passwordHash ?? DUMMY_PASSWORD_HASH,
        parsed.data.password,
      );

      if (!user || !passwordOk) {
        await recordAudit(app, audit, {
          event: "auth.login.failure",
          success: false,
          actorEmail: parsed.data.email,
          ip: request.ip,
        });
        return sendApiError(reply, 401, "invalid_credentials", "Invalid email or password");
      }

      await sessions.createSession(user.id, reply);
      await recordAudit(app, audit, {
        event: "auth.login.success",
        success: true,
        actorUserId: user.id,
        actorEmail: user.email,
        ip: request.ip,
      });
      return loginResponseSchema.parse({
        user: toAuthUser(user),
      });
    });
  });

  app.post("/api/v1/auth/logout", async (request, reply) => {
    if (!(await requireCsrf(request, reply))) {
      return;
    }
    // Look up the session/user for audit purposes without going through `resolveSession` —
    // that call can rotate the token (deleting the current row and creating a new one) when
    // it's inside the renewal window, which would make the subsequent `destroySession` (which
    // reads the original, now-stale cookie) fail to delete the just-rotated row.
    const rawToken = request.cookies[SESSION_COOKIE_NAME];
    let actor: { id: string; email: string } | null = null;
    if (rawToken) {
      const session = await repos.sessions.findByTokenHash(hashToken(rawToken));
      if (session) {
        const user = await repos.users.findById(session.userId);
        if (user) {
          actor = { id: user.id, email: user.email };
        }
      }
    }

    await sessions.destroySession(request, reply);
    await recordAudit(app, audit, {
      event: "auth.logout",
      success: true,
      actorUserId: actor?.id ?? null,
      actorEmail: actor?.email ?? null,
      ip: request.ip,
    });
    return logoutResponseSchema.parse({ ok: true });
  });

  await app.register(async (setupScope) => {
    await setupScope.register(rateLimit, {
      max: options.setupRateLimitMax,
      timeWindow: options.setupRateLimitWindowMs,
      hook: "preHandler",
      errorResponseBuilder: () => ({
        error: {
          code: "rate_limited",
          message: "Too many setup attempts. Try again later.",
        },
      }),
    });

    setupScope.post(SETUP_COMPLETE_PATH, async (request, reply) => {
      logSetupDiagnostics(
        app,
        options.nodeEnv,
        { endpoint: SETUP_COMPLETE_PATH },
        "Received first-run setup completion request",
      );

      // Anonymous CSRF: double-submit cookie issued via GET /api/v1/auth/csrf before setup.
      if (!(await requireCsrf(request, reply))) {
        return;
      }

      const body = request.body;
      if (
        body === null ||
        typeof body !== "object" ||
        !("token" in body) ||
        (body as { token?: unknown }).token === null ||
        (body as { token?: unknown }).token === undefined ||
        (body as { token?: unknown }).token === ""
      ) {
        logSetupDiagnostics(
          app,
          options.nodeEnv,
          { endpoint: SETUP_COMPLETE_PATH, failure: "missing_token" },
          "Setup completion rejected: missing token",
        );
        return sendApiError(reply, 400, "missing_token", SETUP_ERROR_MESSAGES.missing_token);
      }

      const parsed = setupRequestSchema.safeParse(request.body);
      if (!parsed.success) {
        logSetupDiagnostics(
          app,
          options.nodeEnv,
          { endpoint: SETUP_COMPLETE_PATH, failure: "validation_error" },
          "Setup completion rejected: validation error",
        );
        // Password-policy messages are safe (and useful) to return verbatim — they describe
        // the shape of the operator's own input, not internal state. Other validation failures
        // keep the generic message to avoid leaking schema internals.
        const passwordIssue = parsed.error.issues.find((issue) => issue.path[0] === "password");
        return sendApiError(
          reply,
          400,
          "validation_error",
          passwordIssue?.message ?? SETUP_ERROR_MESSAGES.validation_error,
        );
      }

      const result = await setup.completeSetup({
        token: parsed.data.token,
        email: parsed.data.email,
        displayName: parsed.data.displayName,
        password: parsed.data.password,
      });

      if (!result.ok) {
        logSetupDiagnostics(
          app,
          options.nodeEnv,
          { endpoint: SETUP_COMPLETE_PATH, failure: result.reason },
          `Setup completion rejected: ${result.reason}`,
        );
        await recordAudit(app, audit, {
          event: "auth.setup.completed",
          success: false,
          actorEmail: parsed.data.email,
          ip: request.ip,
          metadata: { reason: result.reason },
        });
        return sendApiError(
          reply,
          setupFailureStatus(result.reason),
          result.reason,
          SETUP_ERROR_MESSAGES[result.reason],
        );
      }

      await sessions.createSession(result.user.id, reply);
      await dashboards.getOrCreateDefaultDashboard(result.user.id);
      await recordAudit(app, audit, {
        event: "auth.setup.completed",
        success: true,
        actorUserId: result.user.id,
        actorEmail: result.user.email,
        ip: request.ip,
      });
      return setupResponseSchema.parse({
        user: toAuthUser(result.user),
      });
    });
  });
}
