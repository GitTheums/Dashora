import { and, asc, eq } from "drizzle-orm";
import { type ZodIssue, z } from "zod";
import type { DashoraDatabase } from "../client.js";
import { widgetLayouts } from "../schema.js";
import { nowEpochMillis } from "../timestamps.js";

export const widgetLayoutPlacementSchema = z.object({
  colStart: z.number().int().min(1).max(12),
  colSpan: z.number().int().min(1).max(12),
  rowOrder: z.number().int().min(0),
  rowSpan: z.number().int().min(1).max(24),
});

export type WidgetLayoutPlacement = z.infer<typeof widgetLayoutPlacementSchema>;

export type WidgetLayoutRecord = typeof widgetLayouts.$inferSelect;

export type NewWidgetLayoutInput = WidgetLayoutPlacement & {
  widgetId: string;
  pageId: string;
  id?: string;
  createdAt?: number;
  updatedAt?: number;
};

export type UpdateWidgetLayoutInput = Partial<WidgetLayoutPlacement> & {
  updatedAt?: number;
};

function assertPlacement(input: WidgetLayoutPlacement): WidgetLayoutPlacement {
  const parsed = widgetLayoutPlacementSchema.safeParse(input);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue: ZodIssue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid widget layout placement: ${details}`);
  }
  if (parsed.data.colStart + parsed.data.colSpan - 1 > 12) {
    throw new Error("Invalid widget layout placement: colStart + colSpan exceeds 12 columns");
  }
  return parsed.data;
}

export function createWidgetLayoutsRepository(db: DashoraDatabase) {
  async function findById(id: string): Promise<WidgetLayoutRecord | undefined> {
    return db.query.widgetLayouts.findFirst({ where: eq(widgetLayouts.id, id) });
  }

  async function findByWidgetId(widgetId: string): Promise<WidgetLayoutRecord | undefined> {
    return db.query.widgetLayouts.findFirst({
      where: eq(widgetLayouts.widgetId, widgetId),
    });
  }

  async function create(input: NewWidgetLayoutInput): Promise<WidgetLayoutRecord> {
    const placement = assertPlacement(input);
    const now = nowEpochMillis();
    const [row] = await db
      .insert(widgetLayouts)
      .values({
        id: input.id,
        widgetId: input.widgetId,
        pageId: input.pageId,
        ...placement,
        createdAt: input.createdAt ?? now,
        updatedAt: input.updatedAt ?? now,
      })
      .returning();
    if (!row) {
      throw new Error("Failed to create widget layout");
    }
    return row;
  }

  async function update(
    id: string,
    input: UpdateWidgetLayoutInput,
  ): Promise<WidgetLayoutRecord | undefined> {
    const current = await findById(id);
    if (!current) {
      return undefined;
    }
    const placement = assertPlacement({
      colStart: input.colStart ?? current.colStart,
      colSpan: input.colSpan ?? current.colSpan,
      rowOrder: input.rowOrder ?? current.rowOrder,
      rowSpan: input.rowSpan ?? current.rowSpan,
    });
    const [row] = await db
      .update(widgetLayouts)
      .set({
        ...placement,
        updatedAt: input.updatedAt ?? nowEpochMillis(),
      })
      .where(eq(widgetLayouts.id, id))
      .returning();
    return row;
  }

  return {
    create,
    findById,
    findByWidgetId,
    update,

    async listByPage(pageId: string): Promise<WidgetLayoutRecord[]> {
      return db
        .select()
        .from(widgetLayouts)
        .where(eq(widgetLayouts.pageId, pageId))
        .orderBy(asc(widgetLayouts.rowOrder), asc(widgetLayouts.colStart));
    },

    async upsertForWidget(input: NewWidgetLayoutInput): Promise<WidgetLayoutRecord> {
      const existing = await findByWidgetId(input.widgetId);
      if (!existing) {
        return create(input);
      }
      const updated = await update(existing.id, input);
      if (!updated) {
        throw new Error("Failed to update widget layout");
      }
      return updated;
    },

    async deleteById(id: string): Promise<boolean> {
      const result = await db
        .delete(widgetLayouts)
        .where(eq(widgetLayouts.id, id))
        .returning({ id: widgetLayouts.id });
      return result.length > 0;
    },

    async deleteByWidgetId(widgetId: string): Promise<boolean> {
      const result = await db
        .delete(widgetLayouts)
        .where(eq(widgetLayouts.widgetId, widgetId))
        .returning({ id: widgetLayouts.id });
      return result.length > 0;
    },

    async findByPageAndWidget(
      pageId: string,
      widgetId: string,
    ): Promise<WidgetLayoutRecord | undefined> {
      return db.query.widgetLayouts.findFirst({
        where: and(eq(widgetLayouts.pageId, pageId), eq(widgetLayouts.widgetId, widgetId)),
      });
    },
  };
}

export type WidgetLayoutsRepository = ReturnType<typeof createWidgetLayoutsRepository>;
