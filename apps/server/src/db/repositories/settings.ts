import { and, eq } from "drizzle-orm";
import type { z } from "zod";
import type { DashoraDatabase } from "../client.js";
import { type JsonValue, jsonValueSchema, parseJsonColumn, serializeJson } from "../json.js";
import { settings } from "../schema.js";
import { nowEpochMillis } from "../timestamps.js";

export const settingValueSchema = jsonValueSchema;
export type SettingValue = z.infer<typeof settingValueSchema>;

export type SettingRecord = typeof settings.$inferSelect;
export type SettingWithValue = Omit<SettingRecord, "valueJson"> & {
  value: SettingValue;
};

export type NewSettingInput = {
  userId: string;
  key: string;
  value: SettingValue;
  id?: string;
  createdAt?: number;
  updatedAt?: number;
};

export type UpdateSettingInput = {
  value?: SettingValue;
  updatedAt?: number;
};

function mapSetting(row: SettingRecord): SettingWithValue {
  const value = parseJsonColumn<SettingValue>(
    settingValueSchema,
    row.valueJson,
    "settings.value_json",
  );
  const { valueJson: _valueJson, ...rest } = row;
  return { ...rest, value };
}

export function createSettingsRepository(db: DashoraDatabase) {
  async function findByUserAndKey(
    userId: string,
    key: string,
  ): Promise<SettingWithValue | undefined> {
    const row = await db.query.settings.findFirst({
      where: and(eq(settings.userId, userId), eq(settings.key, key)),
    });
    return row ? mapSetting(row) : undefined;
  }

  async function create(input: NewSettingInput): Promise<SettingWithValue> {
    const now = nowEpochMillis();
    const [row] = await db
      .insert(settings)
      .values({
        id: input.id,
        userId: input.userId,
        key: input.key,
        valueJson: serializeJson(settingValueSchema, input.value, "settings.value_json"),
        createdAt: input.createdAt ?? now,
        updatedAt: input.updatedAt ?? now,
      })
      .returning();
    if (!row) {
      throw new Error("Failed to create setting");
    }
    return mapSetting(row);
  }

  async function update(
    id: string,
    input: UpdateSettingInput,
  ): Promise<SettingWithValue | undefined> {
    const patch: Partial<typeof settings.$inferInsert> = {
      updatedAt: input.updatedAt ?? nowEpochMillis(),
    };
    if (input.value !== undefined) {
      patch.valueJson = serializeJson(settingValueSchema, input.value, "settings.value_json");
    }
    const [row] = await db.update(settings).set(patch).where(eq(settings.id, id)).returning();
    return row ? mapSetting(row) : undefined;
  }

  return {
    create,
    findByUserAndKey,
    update,

    async findById(id: string): Promise<SettingWithValue | undefined> {
      const row = await db.query.settings.findFirst({ where: eq(settings.id, id) });
      return row ? mapSetting(row) : undefined;
    },

    async listByUser(userId: string): Promise<SettingWithValue[]> {
      const rows = await db.select().from(settings).where(eq(settings.userId, userId));
      return rows.map(mapSetting);
    },

    async upsert(input: NewSettingInput): Promise<SettingWithValue> {
      const existing = await findByUserAndKey(input.userId, input.key);
      if (!existing) {
        return create(input);
      }
      const updated = await update(existing.id, { value: input.value });
      if (!updated) {
        throw new Error("Failed to update setting");
      }
      return updated;
    },

    async deleteById(id: string): Promise<boolean> {
      const result = await db
        .delete(settings)
        .where(eq(settings.id, id))
        .returning({ id: settings.id });
      return result.length > 0;
    },

    async deleteByUserAndKey(userId: string, key: string): Promise<boolean> {
      const result = await db
        .delete(settings)
        .where(and(eq(settings.userId, userId), eq(settings.key, key)))
        .returning({ id: settings.id });
      return result.length > 0;
    },
  };
}

export type SettingsRepository = ReturnType<typeof createSettingsRepository>;
export type { JsonValue };
