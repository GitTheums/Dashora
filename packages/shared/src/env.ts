import { z } from "zod";

const booleanFromString = z
  .union([z.boolean(), z.enum(["true", "false", "1", "0"])])
  .transform((value) => value === true || value === "true" || value === "1");

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
