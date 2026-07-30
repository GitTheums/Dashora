import {
  type PageLayoutDocument,
  createDefaultPageLayout,
  pageLayoutDocumentSchema,
  parsePageLayout,
  serializePageLayout,
} from "@dashora/shared";
import { eq } from "drizzle-orm";
import type { DashoraDatabase } from "../client.js";
import { pageLayouts } from "../schema.js";
import { nowEpochMillis } from "../timestamps.js";

export type PageLayoutRecord = typeof pageLayouts.$inferSelect;

export type PageLayoutWithDocument = {
  id: string;
  pageId: string;
  layout: PageLayoutDocument;
  createdAt: number;
  updatedAt: number;
};

function mapRecord(row: PageLayoutRecord): PageLayoutWithDocument {
  return {
    id: row.id,
    pageId: row.pageId,
    layout: parsePageLayout(row.layoutsJson),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function createPageLayoutsRepository(db: DashoraDatabase) {
  return {
    async findByPageId(pageId: string): Promise<PageLayoutWithDocument | undefined> {
      const row = await db.query.pageLayouts.findFirst({
        where: eq(pageLayouts.pageId, pageId),
      });
      return row ? mapRecord(row) : undefined;
    },

    async upsertForPage(
      pageId: string,
      layout: PageLayoutDocument,
    ): Promise<PageLayoutWithDocument> {
      const parsed = pageLayoutDocumentSchema.parse(layout);
      const layoutsJson = serializePageLayout(parsed);
      const now = nowEpochMillis();
      const existing = await db.query.pageLayouts.findFirst({
        where: eq(pageLayouts.pageId, pageId),
      });

      if (!existing) {
        const [row] = await db
          .insert(pageLayouts)
          .values({
            pageId,
            layoutsJson,
            createdAt: now,
            updatedAt: now,
          })
          .returning();
        if (!row) {
          throw new Error("Failed to create page layout");
        }
        return mapRecord(row);
      }

      const [row] = await db
        .update(pageLayouts)
        .set({
          layoutsJson,
          updatedAt: now,
        })
        .where(eq(pageLayouts.id, existing.id))
        .returning();
      if (!row) {
        throw new Error("Failed to update page layout");
      }
      return mapRecord(row);
    },

    async deleteByPageId(pageId: string): Promise<boolean> {
      const result = await db
        .delete(pageLayouts)
        .where(eq(pageLayouts.pageId, pageId))
        .returning({ id: pageLayouts.id });
      return result.length > 0;
    },

    defaultLayout(): PageLayoutDocument {
      return createDefaultPageLayout();
    },
  };
}

export type PageLayoutsRepository = ReturnType<typeof createPageLayoutsRepository>;
