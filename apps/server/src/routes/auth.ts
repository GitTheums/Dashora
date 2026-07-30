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
import { CSRF_COOKIE_NAME } from "../auth/cookies.js";
import { isStateChangingMethod, sendCsrfError, validateCsrf } from "../auth/csrf.js";
import { DUMMY_PASSWORD_HASH, verifyPassword } from "../auth/password.js";
import type { SessionService } from "../auth/session-service.js";
import {
  SETUP_ERROR_MESSAGES,
  type SetupService,
  type SetupTokenFailureReason,
} from "../auth/setup-service.js";
import { toAuthUser } from "../auth/user-mapper.js";
import type { Repositories } from "../db/repositories/index.js";
import { sendApiError } from "../http/errors.js";
import type { DashboardService } from "../services/dashboard-service.js";

export type AuthRouteOptions = {
  repos: Repositories;
  sessions: SessionService;
  setup: SetupService;
  dashboards: DashboardService;
  loginRateLimitMax: number;
  loginRateLimitWindowMs: number;
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
  const { repos, sessions, setup, dashboards } = options;

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
        return sendApiError(reply, 401, "invalid_credentials", "Invalid email or password");
      }

      await sessions.createSession(user.id, reply);
      return loginResponseSchema.parse({
        user: toAuthUser(user),
      });
    });
  });

  app.post("/api/v1/auth/logout", async (request, reply) => {
    if (!(await requireCsrf(request, reply))) {
      return;
    }
    await sessions.destroySession(request, reply);
    return logoutResponseSchema.parse({ ok: true });
  });

  app.post(SETUP_COMPLETE_PATH, async (request, reply) => {
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
      return sendApiError(reply, 400, "validation_error", SETUP_ERROR_MESSAGES.validation_error);
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
      return sendApiError(
        reply,
        setupFailureStatus(result.reason),
        result.reason,
        SETUP_ERROR_MESSAGES[result.reason],
      );
    }

    await sessions.createSession(result.user.id, reply);
    await dashboards.getOrCreateDefaultDashboard(result.user.id);
    return setupResponseSchema.parse({
      user: toAuthUser(result.user),
    });
  });
}
