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
