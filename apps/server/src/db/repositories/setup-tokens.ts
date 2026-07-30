import { eq } from "drizzle-orm";
import type { DashoraDatabase } from "../client.js";
import { setupTokens } from "../schema.js";
import { nowEpochMillis } from "../timestamps.js";

/** Singleton row id for the active first-run setup token. */
export const ACTIVE_SETUP_TOKEN_ID = "active";

export type SetupTokenRecord = typeof setupTokens.$inferSelect;

export type NewSetupTokenInput = {
  tokenHash: string;
  createdAt: number;
  expiresAt: number;
  id?: string;
};

export function createSetupTokensRepository(db: DashoraDatabase) {
  return {
    async getActive(): Promise<SetupTokenRecord | undefined> {
      return db.query.setupTokens.findFirst({
        where: eq(setupTokens.id, ACTIVE_SETUP_TOKEN_ID),
      });
    },

    async upsertActive(input: NewSetupTokenInput): Promise<SetupTokenRecord> {
      const id = input.id ?? ACTIVE_SETUP_TOKEN_ID;
      const [row] = await db
        .insert(setupTokens)
        .values({
          id,
          tokenHash: input.tokenHash,
          createdAt: input.createdAt,
          expiresAt: input.expiresAt,
        })
        .onConflictDoUpdate({
          target: setupTokens.id,
          set: {
            tokenHash: input.tokenHash,
            createdAt: input.createdAt,
            expiresAt: input.expiresAt,
          },
        })
        .returning();
      if (!row) {
        throw new Error("Failed to persist setup token");
      }
      return row;
    },

    async deleteActive(): Promise<boolean> {
      const result = await db
        .delete(setupTokens)
        .where(eq(setupTokens.id, ACTIVE_SETUP_TOKEN_ID))
        .returning({ id: setupTokens.id });
      return result.length > 0;
    },

    async deleteAll(): Promise<number> {
      const result = await db.delete(setupTokens).returning({ id: setupTokens.id });
      return result.length;
    },

    async deleteExpired(now: number = nowEpochMillis()): Promise<number> {
      const active = await this.getActive();
      if (!active || active.expiresAt >= now) {
        return 0;
      }
      const deleted = await this.deleteActive();
      return deleted ? 1 : 0;
    },
  };
}

export type SetupTokensRepository = ReturnType<typeof createSetupTokensRepository>;
