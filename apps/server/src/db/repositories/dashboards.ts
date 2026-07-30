import { and, eq } from "drizzle-orm";
import type { DashoraDatabase } from "../client.js";
import { dashboards } from "../schema.js";
import { nowEpochMillis } from "../timestamps.js";

export type DashboardRecord = typeof dashboards.$inferSelect;
export type NewDashboardInput = {
  ownerUserId: string;
  name: string;
  slug: string;
  id?: string;
  createdAt?: number;
  updatedAt?: number;
};

export type UpdateDashboardInput = {
  name?: string;
  slug?: string;
  updatedAt?: number;
};

export function createDashboardsRepository(db: DashoraDatabase) {
  return {
    async create(input: NewDashboardInput): Promise<DashboardRecord> {
      const now = nowEpochMillis();
      const [row] = await db
        .insert(dashboards)
        .values({
          id: input.id,
          ownerUserId: input.ownerUserId,
          name: input.name,
          slug: input.slug,
          createdAt: input.createdAt ?? now,
          updatedAt: input.updatedAt ?? now,
        })
        .returning();
      if (!row) {
        throw new Error("Failed to create dashboard");
      }
      return row;
    },

    async findById(id: string): Promise<DashboardRecord | undefined> {
      return db.query.dashboards.findFirst({ where: eq(dashboards.id, id) });
    },

    async findByOwnerAndSlug(
      ownerUserId: string,
      slug: string,
    ): Promise<DashboardRecord | undefined> {
      return db.query.dashboards.findFirst({
        where: and(eq(dashboards.ownerUserId, ownerUserId), eq(dashboards.slug, slug)),
      });
    },

    async listByOwner(ownerUserId: string): Promise<DashboardRecord[]> {
      return db.select().from(dashboards).where(eq(dashboards.ownerUserId, ownerUserId));
    },

    async update(id: string, input: UpdateDashboardInput): Promise<DashboardRecord | undefined> {
      const [row] = await db
        .update(dashboards)
        .set({
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.slug !== undefined ? { slug: input.slug } : {}),
          updatedAt: input.updatedAt ?? nowEpochMillis(),
        })
        .where(eq(dashboards.id, id))
        .returning();
      return row;
    },

    async deleteById(id: string): Promise<boolean> {
      const result = await db
        .delete(dashboards)
        .where(eq(dashboards.id, id))
        .returning({ id: dashboards.id });
      return result.length > 0;
    },
  };
}

export type DashboardsRepository = ReturnType<typeof createDashboardsRepository>;
