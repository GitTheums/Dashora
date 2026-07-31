import type { FastifyReply, FastifyRequest } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { type TestDatabase, createTestDatabase } from "../db/test-utils.js";
import { SESSION_COOKIE_NAME } from "./cookies.js";
import { createSessionService } from "./session-service.js";

type FakeReply = FastifyReply & {
  cookies: Record<string, string>;
  cleared: string[];
};

function fakeReply(): FakeReply {
  const cookies: Record<string, string> = {};
  const cleared: string[] = [];
  return {
    cookies,
    cleared,
    setCookie(name: string, value: string) {
      cookies[name] = value;
      return this;
    },
    clearCookie(name: string) {
      cleared.push(name);
      delete cookies[name];
      return this;
    },
  } as unknown as FakeReply;
}

function fakeRequest(cookieValue: string | undefined): FastifyRequest {
  return { cookies: cookieValue ? { [SESSION_COOKIE_NAME]: cookieValue } : {} } as FastifyRequest;
}

describe("session rotation", () => {
  let db: TestDatabase;

  afterEach(() => {
    db?.cleanup();
  });

  it("rotates the token value once the renewal threshold is reached, invalidating the old cookie", async () => {
    db = createTestDatabase();
    const user = await db.repos.users.create({
      email: "operator@example.com",
      passwordHash: "unused",
      displayName: "Operator",
    });

    const sessions = createSessionService({
      repos: db.repos,
      sessionTtlMs: 10_000,
      sessionRenewalThresholdMs: 10_000, // always inside the renewal window for this test
      cookieSecure: false,
      nodeEnv: "test",
    });

    const loginReply = fakeReply();
    await sessions.createSession(user.id, loginReply);
    const originalToken = loginReply.cookies[SESSION_COOKIE_NAME];
    expect(originalToken).toBeTruthy();

    const resolveReply = fakeReply();
    const resolved = await sessions.resolveSession(fakeRequest(originalToken), resolveReply);
    expect(resolved?.user.id).toBe(user.id);

    const rotatedToken = resolveReply.cookies[SESSION_COOKIE_NAME];
    expect(rotatedToken).toBeTruthy();
    expect(rotatedToken).not.toBe(originalToken);

    // The old token must no longer resolve to a session (it was deleted, not just left stale).
    const staleReply = fakeReply();
    const staleResult = await sessions.resolveSession(fakeRequest(originalToken), staleReply);
    expect(staleResult).toBeNull();

    // The new token resolves normally.
    const freshReply = fakeReply();
    const freshResult = await sessions.resolveSession(fakeRequest(rotatedToken), freshReply);
    expect(freshResult?.user.id).toBe(user.id);
  });

  it("does not rotate the token while comfortably within its lifetime", async () => {
    db = createTestDatabase();
    const user = await db.repos.users.create({
      email: "operator2@example.com",
      passwordHash: "unused",
      displayName: "Operator",
    });

    const sessions = createSessionService({
      repos: db.repos,
      sessionTtlMs: 10_000,
      sessionRenewalThresholdMs: 1, // renewal window is effectively never hit here
      cookieSecure: false,
      nodeEnv: "test",
    });

    const loginReply = fakeReply();
    await sessions.createSession(user.id, loginReply);
    const originalToken = loginReply.cookies[SESSION_COOKIE_NAME];

    const resolveReply = fakeReply();
    const resolved = await sessions.resolveSession(fakeRequest(originalToken), resolveReply);
    expect(resolved?.user.id).toBe(user.id);
    expect(resolveReply.cookies[SESSION_COOKIE_NAME]).toBeUndefined();

    // The same token still resolves (was touched, not rotated or deleted).
    const secondReply = fakeReply();
    const secondResolved = await sessions.resolveSession(fakeRequest(originalToken), secondReply);
    expect(secondResolved?.user.id).toBe(user.id);
  });
});
