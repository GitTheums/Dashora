import { eq } from "drizzle-orm";
import type { DashoraDatabase } from "../client.js";
import { users } from "../schema.js";
import { nowEpochMillis } from "../timestamps.js";

export type UserRecord = typeof users.$inferSelect;
export type NewUserInput = {
  email: string;
  passwordHash: string;
  displayName: string;
  id?: string;
  createdAt?: number;
  updatedAt?: number;
};

export type UpdateUserInput = {
  email?: string;
  passwordHash?: string;
  displayName?: string;
  updatedAt?: number;
};

export function createUsersRepository(db: DashoraDatabase) {
  return {
    async create(input: NewUserInput): Promise<UserRecord> {
      const now = nowEpochMillis();
      const [row] = await db
        .insert(users)
        .values({
          id: input.id,
          email: input.email.toLowerCase(),
          passwordHash: input.passwordHash,
          displayName: input.displayName,
          createdAt: input.createdAt ?? now,
          updatedAt: input.updatedAt ?? now,
        })
        .returning();
      if (!row) {
        throw new Error("Failed to create user");
      }
      return row;
    },

    async findById(id: string): Promise<UserRecord | undefined> {
      return db.query.users.findFirst({ where: eq(users.id, id) });
    },

    async findByEmail(email: string): Promise<UserRecord | undefined> {
      return db.query.users.findFirst({
        where: eq(users.email, email.toLowerCase()),
      });
    },

    async list(): Promise<UserRecord[]> {
      return db.select().from(users);
    },

    async count(): Promise<number> {
      const rows = await db.select({ id: users.id }).from(users);
      return rows.length;
    },

    async update(id: string, input: UpdateUserInput): Promise<UserRecord | undefined> {
      const [row] = await db
        .update(users)
        .set({
          ...(input.email !== undefined ? { email: input.email.toLowerCase() } : {}),
          ...(input.passwordHash !== undefined ? { passwordHash: input.passwordHash } : {}),
          ...(input.displayName !== undefined ? { displayName: input.displayName } : {}),
          updatedAt: input.updatedAt ?? nowEpochMillis(),
        })
        .where(eq(users.id, id))
        .returning();
      return row;
    },

    async deleteById(id: string): Promise<boolean> {
      const result = await db.delete(users).where(eq(users.id, id)).returning({ id: users.id });
      return result.length > 0;
    },
  };
}

export type UsersRepository = ReturnType<typeof createUsersRepository>;
