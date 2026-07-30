import { eq } from "drizzle-orm";
import type { z } from "zod";
import type { DashoraDatabase } from "../client.js";
import { jsonObjectSchema, parseJsonColumn, serializeJson } from "../json.js";
import { integrations } from "../schema.js";
import { nowEpochMillis } from "../timestamps.js";

export const integrationConfigSchema = jsonObjectSchema;
export type IntegrationConfig = z.infer<typeof integrationConfigSchema>;

export type IntegrationRecord = typeof integrations.$inferSelect;
export type IntegrationWithConfig = Omit<IntegrationRecord, "configJson"> & {
  config: IntegrationConfig;
};

export type NewIntegrationInput = {
  userId: string;
  provider: string;
  name: string;
  config?: IntegrationConfig;
  id?: string;
  createdAt?: number;
  updatedAt?: number;
};

export type UpdateIntegrationInput = {
  provider?: string;
  name?: string;
  config?: IntegrationConfig;
  updatedAt?: number;
};

function mapIntegration(row: IntegrationRecord): IntegrationWithConfig {
  const config = parseJsonColumn<IntegrationConfig>(
    integrationConfigSchema,
    row.configJson,
    "integrations.config_json",
  );
  const { configJson: _configJson, ...rest } = row;
  return { ...rest, config };
}

export function createIntegrationsRepository(db: DashoraDatabase) {
  return {
    async create(input: NewIntegrationInput): Promise<IntegrationWithConfig> {
      const now = nowEpochMillis();
      const [row] = await db
        .insert(integrations)
        .values({
          id: input.id,
          userId: input.userId,
          provider: input.provider,
          name: input.name,
          configJson: serializeJson(
            integrationConfigSchema,
            input.config ?? {},
            "integrations.config_json",
          ),
          createdAt: input.createdAt ?? now,
          updatedAt: input.updatedAt ?? now,
        })
        .returning();
      if (!row) {
        throw new Error("Failed to create integration");
      }
      return mapIntegration(row);
    },

    async findById(id: string): Promise<IntegrationWithConfig | undefined> {
      const row = await db.query.integrations.findFirst({
        where: eq(integrations.id, id),
      });
      return row ? mapIntegration(row) : undefined;
    },

    async listByUser(userId: string): Promise<IntegrationWithConfig[]> {
      const rows = await db.select().from(integrations).where(eq(integrations.userId, userId));
      return rows.map(mapIntegration);
    },

    async update(
      id: string,
      input: UpdateIntegrationInput,
    ): Promise<IntegrationWithConfig | undefined> {
      const patch: Partial<typeof integrations.$inferInsert> = {
        updatedAt: input.updatedAt ?? nowEpochMillis(),
      };
      if (input.provider !== undefined) {
        patch.provider = input.provider;
      }
      if (input.name !== undefined) {
        patch.name = input.name;
      }
      if (input.config !== undefined) {
        patch.configJson = serializeJson(
          integrationConfigSchema,
          input.config,
          "integrations.config_json",
        );
      }
      const [row] = await db
        .update(integrations)
        .set(patch)
        .where(eq(integrations.id, id))
        .returning();
      return row ? mapIntegration(row) : undefined;
    },

    async deleteById(id: string): Promise<boolean> {
      const result = await db
        .delete(integrations)
        .where(eq(integrations.id, id))
        .returning({ id: integrations.id });
      return result.length > 0;
    },
  };
}

export type IntegrationsRepository = ReturnType<typeof createIntegrationsRepository>;
