import type { ServerEnv } from "@dashora/shared";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import Fastify, { type FastifyInstance } from "fastify";
import { createSessionService } from "./auth/session-service.js";
import { type SetupService, createSetupService } from "./auth/setup-service.js";
import type { OpenedDatabase } from "./db/client.js";
import { type Repositories, createRepositories } from "./db/repositories/index.js";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerDashboardRoutes } from "./routes/dashboard.js";
import { registerHealthRoutes } from "./routes/health.js";
import { registerWidgetRoutes } from "./routes/widgets.js";
import { type DashboardService, createDashboardService } from "./services/dashboard-service.js";
import { type TodoService, createTodoService } from "./services/todo-service.js";

/** Paths scrubbed from structured logs — never emit secrets or session material. */
export const LOG_REDACT_PATHS = [
  "req.headers.authorization",
  "req.headers.cookie",
  'req.headers["set-cookie"]',
  'res.headers["set-cookie"]',
  "req.body.password",
  "req.body.token",
  "req.body.csrfToken",
];

export type BuildAppOptions = {
  version: string;
  env: Pick<
    ServerEnv,
    | "NODE_ENV"
    | "CORS_ORIGIN"
    | "TRUST_PROXY"
    | "COOKIE_SECURE"
    | "SESSION_TTL_MS"
    | "SESSION_RENEWAL_THRESHOLD_MS"
    | "SETUP_TOKEN_TTL_MS"
    | "LOGIN_RATE_LIMIT_MAX"
    | "LOGIN_RATE_LIMIT_WINDOW_MS"
    | "PUBLIC_BASE_URL"
    | "PORT"
  >;
  database?: OpenedDatabase;
  logger?: boolean | { level: string };
  /** Optional override for tests. */
  setup?: SetupService;
};

export type AppServices = {
  repos: Repositories;
  setup: SetupService;
  dashboards: DashboardService;
  todos: TodoService;
};

declare module "fastify" {
  interface FastifyInstance {
    dashora: AppServices;
  }
}

function resolvePublicBaseUrl(env: BuildAppOptions["env"]): string {
  if (env.PUBLIC_BASE_URL) {
    return env.PUBLIC_BASE_URL;
  }
  return env.CORS_ORIGIN;
}

export async function buildApp(options: BuildAppOptions): Promise<FastifyInstance> {
  const app = Fastify({
    logger:
      options.logger === false
        ? false
        : {
            level:
              typeof options.logger === "object" && options.logger.level
                ? options.logger.level
                : "info",
            redact: {
              paths: LOG_REDACT_PATHS,
              censor: "[Redacted]",
            },
          },
    trustProxy: options.env.TRUST_PROXY,
  });

  await app.register(cors, {
    origin: options.env.CORS_ORIGIN,
    credentials: true,
  });

  await app.register(cookie);

  await registerHealthRoutes(app, { version: options.version });

  if (!options.database) {
    return app;
  }

  const repos = createRepositories(options.database.db);
  const setup =
    options.setup ??
    createSetupService({
      db: options.database.db,
      setupTokenTtlMs: options.env.SETUP_TOKEN_TTL_MS,
      nodeEnv: options.env.NODE_ENV,
    });
  const dashboards = createDashboardService(repos);
  const todos = createTodoService(repos);
  const sessions = createSessionService({
    repos,
    sessionTtlMs: options.env.SESSION_TTL_MS,
    sessionRenewalThresholdMs: options.env.SESSION_RENEWAL_THRESHOLD_MS,
    cookieSecure: options.env.COOKIE_SECURE,
    nodeEnv: options.env.NODE_ENV,
  });

  app.decorate("dashora", { repos, setup, dashboards, todos });

  // Issue or reuse a persisted setup token once at process start — never on status checks.
  await setup.ensureIssued(app.log, resolvePublicBaseUrl(options.env));

  await registerAuthRoutes(app, {
    repos,
    sessions,
    setup,
    dashboards,
    loginRateLimitMax: options.env.LOGIN_RATE_LIMIT_MAX,
    loginRateLimitWindowMs: options.env.LOGIN_RATE_LIMIT_WINDOW_MS,
    nodeEnv: options.env.NODE_ENV,
  });

  await registerDashboardRoutes(app, { sessions, dashboards });
  await registerWidgetRoutes(app, { sessions, todos });

  return app;
}
