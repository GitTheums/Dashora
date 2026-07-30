import { and, asc, eq, inArray, max } from "drizzle-orm";
import type { DashoraDatabase } from "../client.js";
import { pages } from "../schema.js";
import { nowEpochMillis } from "../timestamps.js";

export type PageRecord = typeof pages.$inferSelect;
export type NewPageInput = {
  dashboardId: string;
  title: string;
  slug: string;
  icon?: string;
  accent?: string | null;
  sortOrder?: number;
  id?: string;
  createdAt?: number;
  updatedAt?: number;
};

export type UpdatePageInput = {
  title?: string;
  slug?: string;
  icon?: string;
  accent?: string | null;
  sortOrder?: number;
  updatedAt?: number;
};

export function createPagesRepository(db: DashoraDatabase) {
  return {
    async create(input: NewPageInput): Promise<PageRecord> {
      const now = nowEpochMillis();
      const [row] = await db
        .insert(pages)
        .values({
          id: input.id,
          dashboardId: input.dashboardId,
          title: input.title,
          slug: input.slug,
          icon: input.icon ?? "home",
          accent: input.accent ?? null,
          sortOrder: input.sortOrder ?? 0,
          createdAt: input.createdAt ?? now,
          updatedAt: input.updatedAt ?? now,
        })
        .returning();
      if (!row) {
        throw new Error("Failed to create page");
      }
      return row;
    },

    async findById(id: string): Promise<PageRecord | undefined> {
      return db.query.pages.findFirst({ where: eq(pages.id, id) });
    },

    async findByDashboardAndSlug(
      dashboardId: string,
      slug: string,
    ): Promise<PageRecord | undefined> {
      return db.query.pages.findFirst({
        where: and(eq(pages.dashboardId, dashboardId), eq(pages.slug, slug)),
      });
    },

    async listByDashboard(dashboardId: string): Promise<PageRecord[]> {
      return db
        .select()
        .from(pages)
        .where(eq(pages.dashboardId, dashboardId))
        .orderBy(asc(pages.sortOrder), asc(pages.createdAt));
    },

    async getMaxSortOrder(dashboardId: string): Promise<number> {
      const [row] = await db
        .select({ value: max(pages.sortOrder) })
        .from(pages)
        .where(eq(pages.dashboardId, dashboardId));
      return row?.value ?? -1;
    },

    async update(id: string, input: UpdatePageInput): Promise<PageRecord | undefined> {
      const [row] = await db
        .update(pages)
        .set({
          ...(input.title !== undefined ? { title: input.title } : {}),
          ...(input.slug !== undefined ? { slug: input.slug } : {}),
          ...(input.icon !== undefined ? { icon: input.icon } : {}),
          ...(input.accent !== undefined ? { accent: input.accent } : {}),
          ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
          updatedAt: input.updatedAt ?? nowEpochMillis(),
        })
        .where(eq(pages.id, id))
        .returning();
      return row;
    },

    /**
     * Persist a full page order. `orderedIds` must be a permutation of the
     * dashboard's current page ids.
     */
    async reorder(dashboardId: string, orderedIds: string[]): Promise<PageRecord[]> {
      const now = nowEpochMillis();
      return db.transaction((tx) => {
        const existing = tx
          .select({ id: pages.id })
          .from(pages)
          .where(eq(pages.dashboardId, dashboardId))
          .all();
        const existingIds = new Set(existing.map((row) => row.id));
        if (existingIds.size !== orderedIds.length) {
          throw new Error("orderedIds must include every page exactly once");
        }
        for (const id of orderedIds) {
          if (!existingIds.has(id)) {
            throw new Error("orderedIds contains an unknown page");
          }
        }
        const unique = new Set(orderedIds);
        if (unique.size !== orderedIds.length) {
          throw new Error("orderedIds must not contain duplicates");
        }

        orderedIds.forEach((id, index) => {
          tx.update(pages)
            .set({ sortOrder: index, updatedAt: now })
            .where(and(eq(pages.id, id), eq(pages.dashboardId, dashboardId)))
            .run();
        });

        return tx
          .select()
          .from(pages)
          .where(eq(pages.dashboardId, dashboardId))
          .orderBy(asc(pages.sortOrder), asc(pages.createdAt))
          .all();
      });
    },

    async countByDashboard(dashboardId: string): Promise<number> {
      const rows = await db
        .select({ id: pages.id })
        .from(pages)
        .where(eq(pages.dashboardId, dashboardId));
      return rows.length;
    },

    async deleteById(id: string): Promise<boolean> {
      const result = await db.delete(pages).where(eq(pages.id, id)).returning({ id: pages.id });
      return result.length > 0;
    },

    async deleteByIds(ids: string[]): Promise<number> {
      if (ids.length === 0) {
        return 0;
      }
      const result = await db
        .delete(pages)
        .where(inArray(pages.id, ids))
        .returning({ id: pages.id });
      return result.length;
    },
  };
}

export type PagesRepository = ReturnType<typeof createPagesRepository>;
