import { eq } from "drizzle-orm";
import type { z } from "zod";
import type { DashoraDatabase } from "../client.js";
import { type JsonValue, jsonObjectSchema, parseJsonColumn, serializeJson } from "../json.js";
import { widgets } from "../schema.js";
import { nowEpochMillis } from "../timestamps.js";

export const widgetConfigSchema = jsonObjectSchema;
export type WidgetConfig = z.infer<typeof widgetConfigSchema>;

export type WidgetRecord = typeof widgets.$inferSelect;
export type WidgetWithConfig = Omit<WidgetRecord, "configJson"> & {
  config: WidgetConfig;
};

export type NewWidgetInput = {
  pageId: string;
  type: string;
  title?: string | null;
  config?: WidgetConfig;
  enabled?: boolean;
  integrationId?: string | null;
  id?: string;
  createdAt?: number;
  updatedAt?: number;
};

export type UpdateWidgetInput = {
  title?: string | null;
  type?: string;
  config?: WidgetConfig;
  enabled?: boolean;
  integrationId?: string | null;
  updatedAt?: number;
};

function mapWidget(row: WidgetRecord): WidgetWithConfig {
  const config = parseJsonColumn<WidgetConfig>(
    widgetConfigSchema,
    row.configJson,
    "widgets.config_json",
  );
  const { configJson: _configJson, ...rest } = row;
  return { ...rest, config };
}

export function createWidgetsRepository(db: DashoraDatabase) {
  return {
    async create(input: NewWidgetInput): Promise<WidgetWithConfig> {
      const now = nowEpochMillis();
      const [row] = await db
        .insert(widgets)
        .values({
          id: input.id,
          pageId: input.pageId,
          type: input.type,
          title: input.title ?? null,
          configJson: serializeJson(widgetConfigSchema, input.config ?? {}, "widgets.config_json"),
          enabled: input.enabled ?? true,
          integrationId: input.integrationId ?? null,
          createdAt: input.createdAt ?? now,
          updatedAt: input.updatedAt ?? now,
        })
        .returning();
      if (!row) {
        throw new Error("Failed to create widget");
      }
      return mapWidget(row);
    },

    async findById(id: string): Promise<WidgetWithConfig | undefined> {
      const row = await db.query.widgets.findFirst({ where: eq(widgets.id, id) });
      return row ? mapWidget(row) : undefined;
    },

    async listByPage(pageId: string): Promise<WidgetWithConfig[]> {
      const rows = await db.select().from(widgets).where(eq(widgets.pageId, pageId));
      return rows.map(mapWidget);
    },

    async update(id: string, input: UpdateWidgetInput): Promise<WidgetWithConfig | undefined> {
      const patch: Partial<typeof widgets.$inferInsert> = {
        updatedAt: input.updatedAt ?? nowEpochMillis(),
      };
      if (input.title !== undefined) {
        patch.title = input.title;
      }
      if (input.type !== undefined) {
        patch.type = input.type;
      }
      if (input.config !== undefined) {
        patch.configJson = serializeJson(widgetConfigSchema, input.config, "widgets.config_json");
      }
      if (input.enabled !== undefined) {
        patch.enabled = input.enabled;
      }
      if (input.integrationId !== undefined) {
        patch.integrationId = input.integrationId;
      }

      const [row] = await db.update(widgets).set(patch).where(eq(widgets.id, id)).returning();
      return row ? mapWidget(row) : undefined;
    },

    async deleteById(id: string): Promise<boolean> {
      const result = await db
        .delete(widgets)
        .where(eq(widgets.id, id))
        .returning({ id: widgets.id });
      return result.length > 0;
    },
  };
}

export type WidgetsRepository = ReturnType<typeof createWidgetsRepository>;

// Re-export for callers validating configs without going through the repo.
export type { JsonValue };
