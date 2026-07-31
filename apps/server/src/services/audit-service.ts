import type { AuditMetadata } from "../db/repositories/audit-events.js";
import type { Repositories } from "../db/repositories/index.js";
import { nowEpochMillis } from "../db/timestamps.js";

/**
 * Closed set of audit event names. Keeping this a union (rather than a free-form string) makes it
 * easy to see, at a glance, every security-relevant action this pass wired up — and prevents typos
 * from silently creating unqueryable event names.
 */
export type AuditEventName =
  | "auth.login.success"
  | "auth.login.failure"
  | "auth.logout"
  | "auth.setup.completed"
  | "settings.theme.updated"
  | "settings.theme.reset"
  | "integration.github.created"
  | "integration.github.updated"
  | "integration.github.deleted"
  | "integration.ics_basic_auth.created"
  | "integration.ics_basic_auth.updated"
  | "integration.ics_basic_auth.deleted"
  | "integration.api_secret.created"
  | "integration.api_secret.updated"
  | "integration.api_secret.deleted"
  | "backup.export"
  | "backup.import";

export type RecordAuditEventInput = {
  event: AuditEventName;
  success: boolean;
  actorUserId?: string | null;
  actorEmail?: string | null;
  ip?: string | null;
  /** Non-secret descriptive fields only (e.g. provider, integration id, field names). */
  metadata?: AuditMetadata;
};

export function createAuditService(repos: Pick<Repositories, "auditEvents">) {
  return {
    /**
     * Fire-and-record: audit logging must never break the request it's observing. Failures are
     * swallowed after being surfaced to the caller via the returned promise rejection only if
     * awaited directly — callers should generally call this without blocking user-facing errors
     * on it (see call sites), but the write itself is still awaited so ordering is deterministic
     * in tests.
     */
    async record(input: RecordAuditEventInput): Promise<void> {
      await repos.auditEvents.create({
        occurredAt: nowEpochMillis(),
        actorUserId: input.actorUserId ?? null,
        actorEmail: input.actorEmail ?? null,
        event: input.event,
        success: input.success,
        ip: input.ip ?? null,
        ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
      });
    },
  };
}

export type AuditService = ReturnType<typeof createAuditService>;
