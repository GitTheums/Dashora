import { and, eq, lt } from "drizzle-orm";
import type { DashoraDatabase } from "../client.js";
import { sessions } from "../schema.js";
import { nowEpochMillis } from "../timestamps.js";

export type SessionRecord = typeof sessions.$inferSelect;
export type NewSessionInput = {
  userId: string;
  tokenHash: string;
  expiresAt: number;
  id?: string;
  createdAt?: number;
  lastSeenAt?: number | null;
};

export function createSessionsRepository(db: DashoraDatabase) {
  return {
    async create(input: NewSessionInput): Promise<SessionRecord> {
      const now = nowEpochMillis();
      const [row] = await db
        .insert(sessions)
        .values({
          id: input.id,
          userId: input.userId,
          tokenHash: input.tokenHash,
          expiresAt: input.expiresAt,
          createdAt: input.createdAt ?? now,
          lastSeenAt: input.lastSeenAt ?? now,
        })
        .returning();
      if (!row) {
        throw new Error("Failed to create session");
      }
      return row;
    },

    async findById(id: string): Promise<SessionRecord | undefined> {
      return db.query.sessions.findFirst({ where: eq(sessions.id, id) });
    },

    async findByTokenHash(tokenHash: string): Promise<SessionRecord | undefined> {
      return db.query.sessions.findFirst({
        where: eq(sessions.tokenHash, tokenHash),
      });
    },

    async listByUserId(userId: string): Promise<SessionRecord[]> {
      return db.select().from(sessions).where(eq(sessions.userId, userId));
    },

    async touch(id: string, at: number = nowEpochMillis()): Promise<SessionRecord | undefined> {
      const [row] = await db
        .update(sessions)
        .set({ lastSeenAt: at })
        .where(eq(sessions.id, id))
        .returning();
      return row;
    },

    async renew(
      id: string,
      expiresAt: number,
      at: number = nowEpochMillis(),
    ): Promise<SessionRecord | undefined> {
      const [row] = await db
        .update(sessions)
        .set({ expiresAt, lastSeenAt: at })
        .where(eq(sessions.id, id))
        .returning();
      return row;
    },

    async deleteById(id: string): Promise<boolean> {
      const result = await db
        .delete(sessions)
        .where(eq(sessions.id, id))
        .returning({ id: sessions.id });
      return result.length > 0;
    },

    async deleteByUserId(userId: string): Promise<number> {
      const result = await db
        .delete(sessions)
        .where(eq(sessions.userId, userId))
        .returning({ id: sessions.id });
      return result.length;
    },

    async deleteExpired(now: number = nowEpochMillis()): Promise<number> {
      const result = await db
        .delete(sessions)
        .where(lt(sessions.expiresAt, now))
        .returning({ id: sessions.id });
      return result.length;
    },

    async isActive(id: string, now: number = nowEpochMillis()): Promise<boolean> {
      const row = await db.query.sessions.findFirst({
        where: and(eq(sessions.id, id)),
      });
      return row !== undefined && row.expiresAt >= now;
    },
  };
}

export type SessionsRepository = ReturnType<typeof createSessionsRepository>;
