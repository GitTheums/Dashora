export const SESSION_COOKIE_NAME = "dashora_session";
export const CSRF_COOKIE_NAME = "dashora_csrf";
export const CSRF_HEADER_NAME = "x-csrf-token";

export type CookieSecureMode = "auto" | boolean;

export type CookieSecurityOptions = {
  cookieSecure: CookieSecureMode;
  nodeEnv: "development" | "test" | "production";
};

export function resolveCookieSecure(options: CookieSecurityOptions): boolean {
  if (options.cookieSecure === "auto") {
    return options.nodeEnv === "production";
  }
  return options.cookieSecure;
}

export type SessionCookieOptions = CookieSecurityOptions & {
  maxAgeMs: number;
};

export function sessionCookieOptions(options: SessionCookieOptions) {
  return {
    path: "/",
    httpOnly: true,
    sameSite: "lax" as const,
    secure: resolveCookieSecure(options),
    maxAge: Math.floor(options.maxAgeMs / 1000),
  };
}

export function csrfCookieOptions(options: CookieSecurityOptions) {
  return {
    path: "/",
    httpOnly: false,
    sameSite: "lax" as const,
    secure: resolveCookieSecure(options),
  };
}

export function clearCookieOptions(options: CookieSecurityOptions) {
  return {
    path: "/",
    httpOnly: true,
    sameSite: "lax" as const,
    secure: resolveCookieSecure(options),
    maxAge: 0,
  };
}

export function clearCsrfCookieOptions(options: CookieSecurityOptions) {
  return {
    path: "/",
    httpOnly: false,
    sameSite: "lax" as const,
    secure: resolveCookieSecure(options),
    maxAge: 0,
  };
}
