import type { FastifyReply, FastifyRequest } from "fastify";
import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from "./cookies.js";
import { safeEqualStrings } from "./tokens.js";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function isStateChangingMethod(method: string): boolean {
  return !SAFE_METHODS.has(method.toUpperCase());
}

/**
 * Double-submit CSRF: cookie (readable by JS) must match X-CSRF-Token header.
 * Applies to cookie-authenticated state-changing requests.
 */
export function validateCsrf(request: FastifyRequest): boolean {
  const cookieToken = request.cookies[CSRF_COOKIE_NAME];
  const headerValue = request.headers[CSRF_HEADER_NAME];
  const headerToken = Array.isArray(headerValue) ? headerValue[0] : headerValue;
  if (!cookieToken || !headerToken) {
    return false;
  }
  return safeEqualStrings(cookieToken, headerToken);
}

export function sendCsrfError(reply: FastifyReply) {
  return reply.status(403).send({
    error: {
      code: "csrf_invalid",
      message: "Missing or invalid CSRF token",
    },
  });
}
