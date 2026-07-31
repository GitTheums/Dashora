import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import type { DashoraDatabase } from "../client.js";
import { parseJsonColumn, serializeJson } from "../json.js";
import { auditEvents } from "../schema.js";
import { nowEpochMillis } from "../timestamps.js";

/**
 * Audit metadata must only ever contain non-secret descriptive scalars (provider names,
 * integration ids, field names that changed) — never tokens, passwords, or ciphertext. Callers
 * (audit-service.ts) are responsible for choosing safe values; this schema only enforces shape.
 */
export const auditMetadataSchema = z.record(
  z.union([z.string(), z.number(), z.boolean(), z.null()]),
);
export type AuditMetadata = z.infer<typeof auditMetadataSchema>;

export type AuditEventRecord = typeof auditEvents.$inferSelect;
export type AuditEventWithMetadata = Omit<AuditEventRecord, "metadataJson"> & {
  metadata: AuditMetadata | null;
};

export type NewAuditEventInput = {
  occurredAt: number;
  actorUserId?: string | null;
  actorEmail?: string | null;
  event: string;
  success: boolean;
  ip?: string | null;
  metadata?: AuditMetadata;
  id?: string;
  createdAt?: number;
};

function mapAuditEvent(row: AuditEventRecord): AuditEventWithMetadata {
  const { metadataJson, ...rest } = row;
  const metadata =
    metadataJson === null
      ? null
      : parseJsonColumn<AuditMetadata>(
          auditMetadataSchema,
          metadataJson,
          "audit_events.metadata_json",
        );
  return { ...rest, metadata };
}

export function createAuditEventsRepository(db: DashoraDatabase) {
  return {
    async create(input: NewAuditEventInput): Promise<AuditEventWithMetadata> {
      const now = nowEpochMillis();
      const [row] = await db
        .insert(auditEvents)
        .values({
          id: input.id,
          occurredAt: input.occurredAt,
          actorUserId: input.actorUserId ?? null,
          actorEmail: input.actorEmail ?? null,
          event: input.event,
          success: input.success,
          ip: input.ip ?? null,
          metadataJson:
            input.metadata !== undefined
              ? serializeJson(auditMetadataSchema, input.metadata, "audit_events.metadata_json")
              : null,
          createdAt: input.createdAt ?? now,
        })
        .returning();
      if (!row) {
        throw new Error("Failed to record audit event");
      }
      return mapAuditEvent(row);
    },

    /** Most recent events first — no admin UI consumes this yet; useful for tests/ops queries. */
    async listRecent(limit = 100): Promise<AuditEventWithMetadata[]> {
      const rows = await db
        .select()
        .from(auditEvents)
        .orderBy(desc(auditEvents.occurredAt))
        .limit(limit);
      return rows.map(mapAuditEvent);
    },

    async listByActor(actorUserId: string, limit = 100): Promise<AuditEventWithMetadata[]> {
      const rows = await db
        .select()
        .from(auditEvents)
        .where(eq(auditEvents.actorUserId, actorUserId))
        .orderBy(desc(auditEvents.occurredAt))
        .limit(limit);
      return rows.map(mapAuditEvent);
    },
  };
}

export type AuditEventsRepository = ReturnType<typeof createAuditEventsRepository>;
