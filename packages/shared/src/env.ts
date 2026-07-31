import { z } from "zod";

const booleanFromString = z
  .union([z.boolean(), z.enum(["true", "false", "1", "0"])])
  .transform((value) => value === true || value === "true" || value === "1");

/** Default data directory for Docker volume mounts (`/data`). Override locally via DASHORA_DATA_DIR. */
export const DEFAULT_DASHORA_DATA_DIR = "/data";

const cookieSecureSchema = z
  .enum(["auto", "true", "false", "1", "0"])
  .default("auto")
  .transform((value) => {
    if (value === "auto") {
      return "auto" as const;
    }
    if (value === "true" || value === "1") {
      return true;
    }
    return false;
  });

export function createServerEnvSchema(defaults: { version: string }) {
  return z.object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    HOST: z.string().min(1).default("0.0.0.0"),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    LOG_LEVEL: z
      .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
      .default("info"),
    APP_VERSION: z.string().min(1).default(defaults.version),
    CORS_ORIGIN: z.string().min(1).default("http://localhost:5173"),
    TRUST_PROXY: booleanFromString.default(false),
    DASHORA_DATA_DIR: z.string().min(1).default(DEFAULT_DASHORA_DATA_DIR),
    /** Public origin used when logging the first-run setup URL. */
    PUBLIC_BASE_URL: z.string().url().optional(),
    /**
     * Secure cookie flag. `auto` enables Secure in production; set `true` behind HTTPS
     * reverse proxies even in non-production, or `false` for plain HTTP.
     */
    COOKIE_SECURE: cookieSecureSchema,
    /** Absolute session lifetime in milliseconds. Default 7 days. */
    SESSION_TTL_MS: z.coerce
      .number()
      .int()
      .positive()
      .default(7 * 24 * 60 * 60 * 1000),
    /**
     * When remaining session lifetime falls below this threshold, renew expiry.
     * Default 1 day.
     */
    SESSION_RENEWAL_THRESHOLD_MS: z.coerce
      .number()
      .int()
      .positive()
      .default(24 * 60 * 60 * 1000),
    SETUP_TOKEN_TTL_MS: z.coerce
      .number()
      .int()
      .positive()
      .default(24 * 60 * 60 * 1000),
    /** Max login attempts per IP within the rate-limit window. */
    LOGIN_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),
    /** Login rate-limit window in milliseconds. Default 15 minutes. */
    LOGIN_RATE_LIMIT_WINDOW_MS: z.coerce
      .number()
      .int()
      .positive()
      .default(15 * 60 * 1000),
    /** Max first-run setup completion attempts per IP within the rate-limit window. */
    SETUP_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(20),
    /** Setup rate-limit window in milliseconds. Default 15 minutes. */
    SETUP_RATE_LIMIT_WINDOW_MS: z.coerce
      .number()
      .int()
      .positive()
      .default(15 * 60 * 1000),
    /** Max `/api/v1/auth/me` session probes per IP within the rate-limit window. */
    AUTH_ME_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(60),
    /** Auth `/me` rate-limit window in milliseconds. Default 1 minute. */
    AUTH_ME_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
    /** General API rate-limit max requests per window (abuse/DoS backstop). */
    API_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(300),
    /** General API rate-limit window in milliseconds. Default 1 minute. */
    API_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
    /** HSTS max-age in seconds when the connection is treated as HTTPS. Default 180 days. */
    HSTS_MAX_AGE_SECONDS: z.coerce.number().int().nonnegative().default(15_552_000),
    /** Global Fastify request body size limit in bytes. */
    MAX_BODY_BYTES: z.coerce.number().int().positive().default(1_000_000),
    /** Outbound User-Agent for provider HTTP requests. */
    PROVIDER_USER_AGENT: z
      .string()
      .min(1)
      .default(`Dashora/${defaults.version} (+https://github.com/GitTheums/Dashora)`),
    /** Time allowed to establish a TCP/TLS connection, in milliseconds. */
    PROVIDER_CONNECT_TIMEOUT_MS: z.coerce.number().int().positive().default(5_000),
    /** Total outbound request budget (including body read), in milliseconds. */
    PROVIDER_REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(15_000),
    /** Maximum accepted upstream response body size in bytes. */
    PROVIDER_MAX_RESPONSE_BYTES: z.coerce.number().int().positive().default(2_000_000),
    /** Maximum number of HTTP redirects to follow for provider requests. */
    PROVIDER_MAX_REDIRECTS: z.coerce.number().int().min(0).max(20).default(5),
    /** Default max requests per provider within the rate-limit window. */
    PROVIDER_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(60),
    /** Provider rate-limit window in milliseconds. Default 1 minute. */
    PROVIDER_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
    /** Consecutive failures before opening a provider circuit. */
    PROVIDER_CIRCUIT_FAILURE_THRESHOLD: z.coerce.number().int().positive().default(5),
    /** How long a provider circuit stays open, in milliseconds. */
    PROVIDER_CIRCUIT_OPEN_MS: z.coerce.number().int().positive().default(30_000),
    /** Default cache TTL for provider HTTP responses, in seconds. */
    PROVIDER_CACHE_TTL_SECONDS: z.coerce.number().int().min(0).max(86_400).default(60),
    /** Default stale-while-revalidate window for provider HTTP responses, in seconds. */
    PROVIDER_CACHE_SWR_SECONDS: z.coerce.number().int().min(0).max(86_400).default(300),
    /**
     * Optional 32-byte key as 64 hex characters for encrypting integration secrets at rest.
     * Required to store GitHub PATs via the integrations API.
     */
    SECRETS_ENCRYPTION_KEY: z
      .string()
      .regex(/^[0-9a-fA-F]{64}$/, "SECRETS_ENCRYPTION_KEY must be 64 hex characters")
      .optional(),
    /**
     * Optional GitHub personal access token used when a widget has no linked credential.
     * Never exposed to the browser.
     */
    GITHUB_TOKEN: z.string().trim().min(1).max(256).optional(),
    /**
     * Optional CoinGecko Demo/Pro API key for the Markets crypto adapter.
     * Never exposed to the browser.
     */
    COINGECKO_API_KEY: z.string().trim().min(1).max(256).optional(),
    /**
     * Optional Finnhub API key for the Markets equities/indexes adapter.
     * Never exposed to the browser.
     */
    FINNHUB_API_KEY: z.string().trim().min(1).max(256).optional(),
    /**
     * Optional Reddit OAuth application credentials for the Reddit widget.
     * Never exposed to the browser.
     */
    REDDIT_CLIENT_ID: z.string().trim().min(1).max(256).optional(),
    REDDIT_CLIENT_SECRET: z.string().trim().min(1).max(256).optional(),
    /**
     * Optional Twitch Helix application credentials for the Twitch widget.
     * Never exposed to the browser.
     */
    TWITCH_CLIENT_ID: z.string().trim().min(1).max(256).optional(),
    TWITCH_CLIENT_SECRET: z.string().trim().min(1).max(256).optional(),
    /** Maximum accepted request body size for config-backup import uploads, in bytes. */
    BACKUP_IMPORT_MAX_BYTES: z.coerce.number().int().positive().default(8_000_000),
  });
}

export type ServerEnv = z.infer<ReturnType<typeof createServerEnvSchema>>;

export function parseServerEnv(
  source: NodeJS.ProcessEnv,
  defaults: { version: string },
): ServerEnv {
  const result = createServerEnvSchema(defaults).safeParse(source);
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid server environment: ${details}`);
  }
  return result.data;
}
