import { describe, expect, it } from "vitest";
import { resolveCookieSecure, sessionCookieOptions } from "./cookies.js";
import { generateOpaqueToken, hashToken, safeEqualStrings } from "./tokens.js";

describe("auth tokens", () => {
  it("hashes opaque tokens stably", () => {
    const token = generateOpaqueToken();
    expect(hashToken(token)).toBe(hashToken(token));
    expect(hashToken(token)).not.toBe(token);
  });

  it("compares strings in constant-ish length checks", () => {
    expect(safeEqualStrings("abc", "abc")).toBe(true);
    expect(safeEqualStrings("abc", "abd")).toBe(false);
    expect(safeEqualStrings("abc", "ab")).toBe(false);
  });
});

describe("cookie security", () => {
  it("resolves auto Secure from NODE_ENV", () => {
    expect(resolveCookieSecure({ cookieSecure: "auto", nodeEnv: "production" })).toBe(true);
    expect(resolveCookieSecure({ cookieSecure: "auto", nodeEnv: "development" })).toBe(false);
    expect(resolveCookieSecure({ cookieSecure: true, nodeEnv: "development" })).toBe(true);
    expect(resolveCookieSecure({ cookieSecure: false, nodeEnv: "production" })).toBe(false);
  });

  it("builds HttpOnly SameSite session cookies", () => {
    const options = sessionCookieOptions({
      cookieSecure: false,
      nodeEnv: "test",
      maxAgeMs: 60_000,
    });
    expect(options.httpOnly).toBe(true);
    expect(options.sameSite).toBe("lax");
    expect(options.secure).toBe(false);
    expect(options.maxAge).toBe(60);
  });
});
