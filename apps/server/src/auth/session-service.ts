import type { FastifyReply, FastifyRequest } from "fastify";
import type { Repositories } from "../db/repositories/index.js";
import { nowEpochMillis } from "../db/timestamps.js";
import {
  CSRF_COOKIE_NAME,
  type CookieSecureMode,
  SESSION_COOKIE_NAME,
  clearCookieOptions,
  clearCsrfCookieOptions,
  csrfCookieOptions,
  sessionCookieOptions,
} from "./cookies.js";
import { generateOpaqueToken, hashToken } from "./tokens.js";
import type { AuthenticatedSession } from "./user-mapper.js";

export type SessionServiceOptions = {
  repos: Repositories;
  sessionTtlMs: number;
  sessionRenewalThresholdMs: number;
  cookieSecure: CookieSecureMode;
  nodeEnv: "development" | "test" | "production";
};

export type SessionService = {
  createSession: (userId: string, reply: FastifyReply) => Promise<void>;
  destroySession: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  resolveSession: (
    request: FastifyRequest,
    reply: FastifyReply,
  ) => Promise<AuthenticatedSession | null>;
  issueCsrfCookie: (reply: FastifyReply, existingToken?: string) => string;
  clearAuthCookies: (reply: FastifyReply) => void;
};

export function createSessionService(options: SessionServiceOptions): SessionService {
  const cookieSecurity = {
    cookieSecure: options.cookieSecure,
    nodeEnv: options.nodeEnv,
  };

  function clearAuthCookies(reply: FastifyReply): void {
    reply.clearCookie(SESSION_COOKIE_NAME, clearCookieOptions(cookieSecurity));
    reply.clearCookie(CSRF_COOKIE_NAME, clearCsrfCookieOptions(cookieSecurity));
  }

  function issueCsrfCookie(reply: FastifyReply, existingToken?: string): string {
    const token = existingToken && existingToken.length > 0 ? existingToken : generateOpaqueToken();
    reply.setCookie(CSRF_COOKIE_NAME, token, csrfCookieOptions(cookieSecurity));
    return token;
  }

  async function createSession(userId: string, reply: FastifyReply): Promise<void> {
    const rawToken = generateOpaqueToken();
    const now = nowEpochMillis();
    await options.repos.sessions.create({
      userId,
      tokenHash: hashToken(rawToken),
      expiresAt: now + options.sessionTtlMs,
      createdAt: now,
      lastSeenAt: now,
    });
    reply.setCookie(
      SESSION_COOKIE_NAME,
      rawToken,
      sessionCookieOptions({ ...cookieSecurity, maxAgeMs: options.sessionTtlMs }),
    );
    issueCsrfCookie(reply);
  }

  async function destroySession(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const rawToken = request.cookies[SESSION_COOKIE_NAME];
    if (rawToken) {
      const session = await options.repos.sessions.findByTokenHash(hashToken(rawToken));
      if (session) {
        await options.repos.sessions.deleteById(session.id);
      }
    }
    clearAuthCookies(reply);
  }

  async function resolveSession(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<AuthenticatedSession | null> {
    const rawToken = request.cookies[SESSION_COOKIE_NAME];
    if (!rawToken) {
      return null;
    }

    const now = nowEpochMillis();
    const session = await options.repos.sessions.findByTokenHash(hashToken(rawToken));
    if (!session || session.expiresAt < now) {
      if (session) {
        await options.repos.sessions.deleteById(session.id);
      }
      clearAuthCookies(reply);
      return null;
    }

    const user = await options.repos.users.findById(session.userId);
    if (!user) {
      await options.repos.sessions.deleteById(session.id);
      clearAuthCookies(reply);
      return null;
    }

    const remaining = session.expiresAt - now;
    let activeSession = session;
    if (remaining <= options.sessionRenewalThresholdMs) {
      const renewed = await options.repos.sessions.renew(
        session.id,
        now + options.sessionTtlMs,
        now,
      );
      if (renewed) {
        activeSession = renewed;
        reply.setCookie(
          SESSION_COOKIE_NAME,
          rawToken,
          sessionCookieOptions({ ...cookieSecurity, maxAgeMs: options.sessionTtlMs }),
        );
      }
    } else {
      const touched = await options.repos.sessions.touch(session.id, now);
      if (touched) {
        activeSession = touched;
      }
    }

    return { user, session: activeSession };
  }

  return {
    createSession,
    destroySession,
    resolveSession,
    issueCsrfCookie,
    clearAuthCookies,
  };
}
