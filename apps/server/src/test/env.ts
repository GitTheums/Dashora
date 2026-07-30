import type { ServerEnv } from "@dashora/shared";

export type TestServerEnv = Pick<
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

export function createTestServerEnv(overrides: Partial<TestServerEnv> = {}): TestServerEnv {
  return {
    NODE_ENV: "test",
    CORS_ORIGIN: "http://localhost:5173",
    TRUST_PROXY: false,
    COOKIE_SECURE: false,
    SESSION_TTL_MS: 60_000,
    SESSION_RENEWAL_THRESHOLD_MS: 30_000,
    SETUP_TOKEN_TTL_MS: 60 * 60 * 1000,
    LOGIN_RATE_LIMIT_MAX: 100,
    LOGIN_RATE_LIMIT_WINDOW_MS: 60_000,
    PORT: 3000,
    ...overrides,
  };
}
