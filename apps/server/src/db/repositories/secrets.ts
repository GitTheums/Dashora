import { and, eq } from "drizzle-orm";
import type { DashoraDatabase } from "../client.js";
import { secrets } from "../schema.js";
import { nowEpochMillis } from "../timestamps.js";

export type SecretRecord = typeof secrets.$inferSelect;

export type NewSecretInput = {
  integrationId: string;
  key: string;
  ciphertext: string;
  id?: string;
  createdAt?: number;
  updatedAt?: number;
};

export type UpdateSecretInput = {
  ciphertext?: string;
  key?: string;
  updatedAt?: number;
};

export function createSecretsRepository(db: DashoraDatabase) {
  return {
    async create(input: NewSecretInput): Promise<SecretRecord> {
      if (input.ciphertext.length === 0) {
        throw new Error("Secret ciphertext must not be empty");
      }
      const now = nowEpochMillis();
      const [row] = await db
        .insert(secrets)
        .values({
          id: input.id,
          integrationId: input.integrationId,
          key: input.key,
          ciphertext: input.ciphertext,
          createdAt: input.createdAt ?? now,
          updatedAt: input.updatedAt ?? now,
        })
        .returning();
      if (!row) {
        throw new Error("Failed to create secret");
      }
      return row;
    },

    async findById(id: string): Promise<SecretRecord | undefined> {
      return db.query.secrets.findFirst({ where: eq(secrets.id, id) });
    },

    async findByIntegrationAndKey(
      integrationId: string,
      key: string,
    ): Promise<SecretRecord | undefined> {
      return db.query.secrets.findFirst({
        where: and(eq(secrets.integrationId, integrationId), eq(secrets.key, key)),
      });
    },

    async listByIntegration(integrationId: string): Promise<SecretRecord[]> {
      return db.select().from(secrets).where(eq(secrets.integrationId, integrationId));
    },

    async update(id: string, input: UpdateSecretInput): Promise<SecretRecord | undefined> {
      if (input.ciphertext !== undefined && input.ciphertext.length === 0) {
        throw new Error("Secret ciphertext must not be empty");
      }
      const [row] = await db
        .update(secrets)
        .set({
          ...(input.ciphertext !== undefined ? { ciphertext: input.ciphertext } : {}),
          ...(input.key !== undefined ? { key: input.key } : {}),
          updatedAt: input.updatedAt ?? nowEpochMillis(),
        })
        .where(eq(secrets.id, id))
        .returning();
      return row;
    },

    async deleteById(id: string): Promise<boolean> {
      const result = await db
        .delete(secrets)
        .where(eq(secrets.id, id))
        .returning({ id: secrets.id });
      return result.length > 0;
    },
  };
}

export type SecretsRepository = ReturnType<typeof createSecretsRepository>;
