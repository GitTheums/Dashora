import { eq, lt } from "drizzle-orm";
import type { z } from "zod";
import type { DashoraDatabase } from "../client.js";
import { type JsonValue, jsonValueSchema, parseJsonColumn, serializeJson } from "../json.js";
import { cacheEntries } from "../schema.js";
import { nowEpochMillis } from "../timestamps.js";

export const cachePayloadSchema = jsonValueSchema;
export type CachePayload = z.infer<typeof cachePayloadSchema>;

export type CacheEntryRecord = typeof cacheEntries.$inferSelect;
export type CacheEntryWithPayload = Omit<CacheEntryRecord, "payloadJson"> & {
  payload: CachePayload;
};

export type NewCacheEntryInput = {
  cacheKey: string;
  payload: CachePayload;
  fetchedAt: number;
  staleAt: number;
  expiresAt: number;
  widgetId?: string | null;
  id?: string;
  createdAt?: number;
  updatedAt?: number;
};

export type UpdateCacheEntryInput = {
  payload?: CachePayload;
  fetchedAt?: number;
  staleAt?: number;
  expiresAt?: number;
  widgetId?: string | null;
  updatedAt?: number;
};

function mapCacheEntry(row: CacheEntryRecord): CacheEntryWithPayload {
  const payload = parseJsonColumn<CachePayload>(
    cachePayloadSchema,
    row.payloadJson,
    "cache_entries.payload_json",
  );
  const { payloadJson: _payloadJson, ...rest } = row;
  return { ...rest, payload };
}

export function createCacheEntriesRepository(db: DashoraDatabase) {
  async function findByCacheKey(cacheKey: string): Promise<CacheEntryWithPayload | undefined> {
    const row = await db.query.cacheEntries.findFirst({
      where: eq(cacheEntries.cacheKey, cacheKey),
    });
    return row ? mapCacheEntry(row) : undefined;
  }

  async function create(input: NewCacheEntryInput): Promise<CacheEntryWithPayload> {
    const now = nowEpochMillis();
    const [row] = await db
      .insert(cacheEntries)
      .values({
        id: input.id,
        cacheKey: input.cacheKey,
        widgetId: input.widgetId ?? null,
        payloadJson: serializeJson(cachePayloadSchema, input.payload, "cache_entries.payload_json"),
        fetchedAt: input.fetchedAt,
        staleAt: input.staleAt,
        expiresAt: input.expiresAt,
        createdAt: input.createdAt ?? now,
        updatedAt: input.updatedAt ?? now,
      })
      .returning();
    if (!row) {
      throw new Error("Failed to create cache entry");
    }
    return mapCacheEntry(row);
  }

  async function update(
    id: string,
    input: UpdateCacheEntryInput,
  ): Promise<CacheEntryWithPayload | undefined> {
    const patch: Partial<typeof cacheEntries.$inferInsert> = {
      updatedAt: input.updatedAt ?? nowEpochMillis(),
    };
    if (input.payload !== undefined) {
      patch.payloadJson = serializeJson(
        cachePayloadSchema,
        input.payload,
        "cache_entries.payload_json",
      );
    }
    if (input.fetchedAt !== undefined) {
      patch.fetchedAt = input.fetchedAt;
    }
    if (input.staleAt !== undefined) {
      patch.staleAt = input.staleAt;
    }
    if (input.expiresAt !== undefined) {
      patch.expiresAt = input.expiresAt;
    }
    if (input.widgetId !== undefined) {
      patch.widgetId = input.widgetId;
    }
    const [row] = await db
      .update(cacheEntries)
      .set(patch)
      .where(eq(cacheEntries.id, id))
      .returning();
    return row ? mapCacheEntry(row) : undefined;
  }

  return {
    create,
    findByCacheKey,
    update,

    async findById(id: string): Promise<CacheEntryWithPayload | undefined> {
      const row = await db.query.cacheEntries.findFirst({
        where: eq(cacheEntries.id, id),
      });
      return row ? mapCacheEntry(row) : undefined;
    },

    async upsertByCacheKey(input: NewCacheEntryInput): Promise<CacheEntryWithPayload> {
      const existing = await findByCacheKey(input.cacheKey);
      if (!existing) {
        return create(input);
      }
      const patch: UpdateCacheEntryInput = {
        payload: input.payload,
        fetchedAt: input.fetchedAt,
        staleAt: input.staleAt,
        expiresAt: input.expiresAt,
      };
      if (input.widgetId !== undefined) {
        patch.widgetId = input.widgetId;
      }
      const updated = await update(existing.id, patch);
      if (!updated) {
        throw new Error("Failed to update cache entry");
      }
      return updated;
    },

    async deleteById(id: string): Promise<boolean> {
      const result = await db
        .delete(cacheEntries)
        .where(eq(cacheEntries.id, id))
        .returning({ id: cacheEntries.id });
      return result.length > 0;
    },

    async deleteByCacheKey(cacheKey: string): Promise<boolean> {
      const result = await db
        .delete(cacheEntries)
        .where(eq(cacheEntries.cacheKey, cacheKey))
        .returning({ id: cacheEntries.id });
      return result.length > 0;
    },

    async deleteExpired(now: number = nowEpochMillis()): Promise<number> {
      const result = await db
        .delete(cacheEntries)
        .where(lt(cacheEntries.expiresAt, now))
        .returning({ id: cacheEntries.id });
      return result.length;
    },
  };
}

export type CacheEntriesRepository = ReturnType<typeof createCacheEntriesRepository>;
export type { JsonValue };
