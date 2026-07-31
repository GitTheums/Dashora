import type { ServerEnv } from "@dashora/shared";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import Fastify, { type FastifyInstance } from "fastify";
import { createSessionService } from "./auth/session-service.js";
import { type SetupService, createSetupService } from "./auth/setup-service.js";
import type { OpenedDatabase } from "./db/client.js";
import { type Repositories, createRepositories } from "./db/repositories/index.js";
import { registerErrorHandler } from "./http/error-handler.js";
import { registerRequestTiming } from "./http/request-timing.js";
import { type ProviderPlatform, createProviderPlatform } from "./providers/platform.js";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerBackupRoutes } from "./routes/backup.js";
import { registerDashboardRoutes } from "./routes/dashboard.js";
import { registerHealthRoutes } from "./routes/health.js";
import { registerIntegrationRoutes } from "./routes/integrations.js";
import { registerProviderDiagnosticsRoutes } from "./routes/provider-diagnostics.js";
import { registerSettingsRoutes } from "./routes/settings.js";
import { registerWidgetRoutes } from "./routes/widgets.js";
import { createApiSecretService } from "./services/api-secret-service.js";
import { type AuditService, createAuditService } from "./services/audit-service.js";
import { createBackupService } from "./services/backup-service.js";
import { type DashboardService, createDashboardService } from "./services/dashboard-service.js";
import { createGithubIntegrationService } from "./services/github-integration-service.js";
import { createIcsBasicAuthIntegrationService } from "./services/ics-basic-auth-service.js";
import { createThemeSettingsService } from "./services/theme-settings-service.js";
import { type TodoService, createTodoService } from "./services/todo-service.js";

/** Paths scrubbed from structured logs — never emit secrets or session material. */
export const LOG_REDACT_PATHS = [
  "req.headers.authorization",
  "req.headers.cookie",
  'req.headers["set-cookie"]',
  'res.headers["set-cookie"]',
  "req.body.password",
  "req.body.confirmPassword",
  "req.body.token",
  "req.body.secret",
  "req.body.clientSecret",
  "req.body.value",
  "req.body.username",
  "req.body.csrfToken",
  "req.body.headers",
  "req.body.headers[*].value",
  "req.body.widgets[*].config.headers[*].value",
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
    | "SETUP_RATE_LIMIT_MAX"
    | "SETUP_RATE_LIMIT_WINDOW_MS"
    | "API_RATE_LIMIT_MAX"
    | "API_RATE_LIMIT_WINDOW_MS"
    | "HSTS_MAX_AGE_SECONDS"
    | "MAX_BODY_BYTES"
    | "PUBLIC_BASE_URL"
    | "PORT"
    | "PROVIDER_USER_AGENT"
    | "PROVIDER_CONNECT_TIMEOUT_MS"
    | "PROVIDER_REQUEST_TIMEOUT_MS"
    | "PROVIDER_MAX_RESPONSE_BYTES"
    | "PROVIDER_MAX_REDIRECTS"
    | "PROVIDER_RATE_LIMIT_MAX"
    | "PROVIDER_RATE_LIMIT_WINDOW_MS"
    | "PROVIDER_CIRCUIT_FAILURE_THRESHOLD"
    | "PROVIDER_CIRCUIT_OPEN_MS"
    | "PROVIDER_CACHE_TTL_SECONDS"
    | "PROVIDER_CACHE_SWR_SECONDS"
    | "SECRETS_ENCRYPTION_KEY"
    | "GITHUB_TOKEN"
    | "COINGECKO_API_KEY"
    | "FINNHUB_API_KEY"
    | "REDDIT_CLIENT_ID"
    | "REDDIT_CLIENT_SECRET"
    | "TWITCH_CLIENT_ID"
    | "TWITCH_CLIENT_SECRET"
    | "BACKUP_IMPORT_MAX_BYTES"
  >;
  database?: OpenedDatabase;
  logger?: boolean | { level: string };
  /** Optional override for tests. */
  setup?: SetupService;
  /** Optional override for tests. */
  providers?: ProviderPlatform;
};

export type AppServices = {
  repos: Repositories;
  setup: SetupService;
  dashboards: DashboardService;
  todos: TodoService;
  providers: ProviderPlatform;
  audit: AuditService;
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
    bodyLimit: options.env.MAX_BODY_BYTES,
  });

  if (options.env.TRUST_PROXY) {
    app.log.warn(
      "TRUST_PROXY is enabled — this must only run behind a reverse proxy that strips " +
        "client-supplied X-Forwarded-For/X-Forwarded-Proto headers, otherwise rate limiting " +
        "and audit-log IP addresses can be spoofed. See docs/security-model.md.",
    );
  }

  registerErrorHandler(app);
  registerRequestTiming(app);

  // Dashora is a JSON API only (no HTML/static serving) — default-deny CSP and related
  // headers. If a reverse proxy later serves the SPA build, it must set its own CSP with
  // `script-src 'self'` / `style-src 'self' 'unsafe-inline'` (see docs/security-model.md).
  await app.register(helmet, {
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'none'"],
        frameAncestors: ["'none'"],
        baseUri: ["'none'"],
        formAction: ["'none'"],
      },
    },
    frameguard: { action: "deny" },
    noSniff: true,
    referrerPolicy: { policy: "no-referrer" },
    permittedCrossDomainPolicies: { permittedPolicies: "none" },
    crossOriginResourcePolicy: { policy: "same-origin" },
    hsts:
      options.env.COOKIE_SECURE === true ||
      (options.env.COOKIE_SECURE === "auto" && options.env.NODE_ENV === "production")
        ? { maxAge: options.env.HSTS_MAX_AGE_SECONDS, includeSubDomains: true }
        : false,
  });
  app.addHook("onSend", async (_request, reply, payload) => {
    reply.header(
      "Permissions-Policy",
      "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
    );
    return payload;
  });

  await app.register(cors, {
    origin: options.env.CORS_ORIGIN,
    credentials: true,
  });

  await app.register(cookie);

  await app.register(rateLimit, {
    global: true,
    max: options.env.API_RATE_LIMIT_MAX,
    timeWindow: options.env.API_RATE_LIMIT_WINDOW_MS,
    hook: "preHandler",
    errorResponseBuilder: () => ({
      error: { code: "rate_limited", message: "Too many requests. Try again later." },
    }),
  });

  await registerHealthRoutes(app, { version: options.version });

  if (!options.database) {
    return app;
  }

  const repos = createRepositories(options.database.db);
  const audit = createAuditService(repos);
  const setup =
    options.setup ??
    createSetupService({
      db: options.database.db,
      setupTokenTtlMs: options.env.SETUP_TOKEN_TTL_MS,
      nodeEnv: options.env.NODE_ENV,
    });
  const dashboards = createDashboardService(repos);
  const themeSettings = createThemeSettingsService(repos);
  const todos = createTodoService(repos);
  const backup = createBackupService({
    repos,
    db: options.database.db,
    serverVersion: options.version,
  });
  const providers =
    options.providers ??
    createProviderPlatform({
      env: options.env,
      cacheRepository: repos.cacheEntries,
    });
  const githubIntegrations = createGithubIntegrationService({
    repos,
    ...(options.env.SECRETS_ENCRYPTION_KEY
      ? { secretsEncryptionKey: options.env.SECRETS_ENCRYPTION_KEY }
      : {}),
  });
  const icsBasicAuthIntegrations = createIcsBasicAuthIntegrationService({
    repos,
    ...(options.env.SECRETS_ENCRYPTION_KEY
      ? { secretsEncryptionKey: options.env.SECRETS_ENCRYPTION_KEY }
      : {}),
  });
  const apiSecrets = createApiSecretService({
    repos,
    ...(options.env.SECRETS_ENCRYPTION_KEY
      ? { secretsEncryptionKey: options.env.SECRETS_ENCRYPTION_KEY }
      : {}),
  });
  const resolveGithubToken = () => options.env.GITHUB_TOKEN ?? null;
  const resolveCryptoApiKey = () => options.env.COINGECKO_API_KEY ?? null;
  const resolveEquitiesApiKey = () => options.env.FINNHUB_API_KEY ?? null;
  const resolveRedditCredentials = () => {
    const clientId = options.env.REDDIT_CLIENT_ID?.trim();
    const clientSecret = options.env.REDDIT_CLIENT_SECRET?.trim();
    if (!clientId || !clientSecret) {
      return null;
    }
    return { clientId, clientSecret };
  };
  const resolveTwitchCredentials = () => {
    const clientId = options.env.TWITCH_CLIENT_ID?.trim();
    const clientSecret = options.env.TWITCH_CLIENT_SECRET?.trim();
    if (!clientId || !clientSecret) {
      return null;
    }
    return { clientId, clientSecret };
  };
  const sessions = createSessionService({
    repos,
    sessionTtlMs: options.env.SESSION_TTL_MS,
    sessionRenewalThresholdMs: options.env.SESSION_RENEWAL_THRESHOLD_MS,
    cookieSecure: options.env.COOKIE_SECURE,
    nodeEnv: options.env.NODE_ENV,
  });

  app.decorate("dashora", { repos, setup, dashboards, todos, providers, audit });

  app.addHook("onClose", async () => {
    providers.cancel();
  });

  // Issue or reuse a persisted setup token once at process start — never on status checks.
  await setup.ensureIssued(app.log, resolvePublicBaseUrl(options.env));

  await registerAuthRoutes(app, {
    repos,
    sessions,
    setup,
    dashboards,
    audit,
    loginRateLimitMax: options.env.LOGIN_RATE_LIMIT_MAX,
    loginRateLimitWindowMs: options.env.LOGIN_RATE_LIMIT_WINDOW_MS,
    setupRateLimitMax: options.env.SETUP_RATE_LIMIT_MAX,
    setupRateLimitWindowMs: options.env.SETUP_RATE_LIMIT_WINDOW_MS,
    nodeEnv: options.env.NODE_ENV,
  });

  await registerDashboardRoutes(app, { sessions, dashboards });
  await registerSettingsRoutes(app, { sessions, themeSettings, audit });
  await registerWidgetRoutes(app, {
    sessions,
    todos,
    providers,
    githubIntegrations,
    icsBasicAuthIntegrations,
    apiSecrets,
    resolveGithubToken,
    resolveCryptoApiKey,
    resolveEquitiesApiKey,
    resolveRedditCredentials,
    resolveTwitchCredentials,
  });
  await registerIntegrationRoutes(app, {
    sessions,
    githubIntegrations,
    icsBasicAuthIntegrations,
    apiSecrets,
    audit,
  });
  await registerProviderDiagnosticsRoutes(app, { sessions, providers });
  await registerBackupRoutes(app, {
    sessions,
    backup,
    maxImportBytes: options.env.BACKUP_IMPORT_MAX_BYTES,
    audit,
  });

  return app;
}
