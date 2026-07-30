import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/** Opaque session / CSRF / setup token length in bytes. */
export const AUTH_TOKEN_BYTES = 32;

export function generateOpaqueToken(bytes: number = AUTH_TOKEN_BYTES): string {
  return randomBytes(bytes).toString("base64url");
}

/** Store only a hash of opaque tokens (sessions, setup tokens). */
export function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function safeEqualStrings(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) {
    return false;
  }
  return timingSafeEqual(left, right);
}
