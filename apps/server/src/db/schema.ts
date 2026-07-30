import { randomUUID } from "node:crypto";
import { relations } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

/** Unix epoch milliseconds stored as INTEGER. */
const epochMillis = (name: string) => integer(name, { mode: "number" });

export const users = sqliteTable(
  "users",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    displayName: text("display_name").notNull(),
    createdAt: epochMillis("created_at").notNull(),
    updatedAt: epochMillis("updated_at").notNull(),
  },
  (table) => [uniqueIndex("users_email_unique").on(table.email)],
);

export const sessions = sqliteTable(
  "sessions",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade", onUpdate: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: epochMillis("expires_at").notNull(),
    createdAt: epochMillis("created_at").notNull(),
    lastSeenAt: epochMillis("last_seen_at"),
  },
  (table) => [
    uniqueIndex("sessions_token_hash_unique").on(table.tokenHash),
    index("sessions_user_id_idx").on(table.userId),
    index("sessions_expires_at_idx").on(table.expiresAt),
  ],
);

export const dashboards = sqliteTable(
  "dashboards",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    ownerUserId: text("owner_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade", onUpdate: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    createdAt: epochMillis("created_at").notNull(),
    updatedAt: epochMillis("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("dashboards_owner_slug_unique").on(table.ownerUserId, table.slug),
    index("dashboards_owner_user_id_idx").on(table.ownerUserId),
  ],
);

export const pages = sqliteTable(
  "pages",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    dashboardId: text("dashboard_id")
      .notNull()
      .references(() => dashboards.id, { onDelete: "cascade", onUpdate: "cascade" }),
    title: text("title").notNull(),
    slug: text("slug").notNull(),
    /** Stable icon key from the shared page-icon catalog. */
    icon: text("icon").notNull().default("home"),
    /** Optional accent color as `#RRGGBB`. */
    accent: text("accent"),
    sortOrder: integer("sort_order", { mode: "number" }).notNull().default(0),
    createdAt: epochMillis("created_at").notNull(),
    updatedAt: epochMillis("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("pages_dashboard_slug_unique").on(table.dashboardId, table.slug),
    index("pages_dashboard_id_idx").on(table.dashboardId),
  ],
);

export const integrations = sqliteTable(
  "integrations",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade", onUpdate: "cascade" }),
    provider: text("provider").notNull(),
    name: text("name").notNull(),
    /** Non-secret provider config; validated with Zod at the repository boundary. */
    configJson: text("config_json").notNull().default("{}"),
    createdAt: epochMillis("created_at").notNull(),
    updatedAt: epochMillis("updated_at").notNull(),
  },
  (table) => [index("integrations_user_id_idx").on(table.userId)],
);

export const widgets = sqliteTable(
  "widgets",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    pageId: text("page_id")
      .notNull()
      .references(() => pages.id, { onDelete: "cascade", onUpdate: "cascade" }),
    type: text("type").notNull(),
    title: text("title"),
    /** Widget instance config; validated with Zod at the repository boundary. */
    configJson: text("config_json").notNull().default("{}"),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
    integrationId: text("integration_id").references(() => integrations.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    createdAt: epochMillis("created_at").notNull(),
    updatedAt: epochMillis("updated_at").notNull(),
  },
  (table) => [
    index("widgets_page_id_idx").on(table.pageId),
    index("widgets_integration_id_idx").on(table.integrationId),
  ],
);

export const widgetLayouts = sqliteTable(
  "widget_layouts",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    widgetId: text("widget_id")
      .notNull()
      .references(() => widgets.id, { onDelete: "cascade", onUpdate: "cascade" }),
    pageId: text("page_id")
      .notNull()
      .references(() => pages.id, { onDelete: "cascade", onUpdate: "cascade" }),
    colStart: integer("col_start", { mode: "number" }).notNull(),
    colSpan: integer("col_span", { mode: "number" }).notNull(),
    rowOrder: integer("row_order", { mode: "number" }).notNull(),
    rowSpan: integer("row_span", { mode: "number" }).notNull().default(1),
    createdAt: epochMillis("created_at").notNull(),
    updatedAt: epochMillis("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("widget_layouts_widget_id_unique").on(table.widgetId),
    index("widget_layouts_page_id_idx").on(table.pageId),
  ],
);

/**
 * Responsive page layout document (12/8/4-column breakpoint map + placeholder widgets).
 * Validated with Zod (`pageLayoutDocumentSchema`) at the repository boundary.
 */
export const pageLayouts = sqliteTable(
  "page_layouts",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    pageId: text("page_id")
      .notNull()
      .references(() => pages.id, { onDelete: "cascade", onUpdate: "cascade" }),
    layoutsJson: text("layouts_json").notNull(),
    createdAt: epochMillis("created_at").notNull(),
    updatedAt: epochMillis("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("page_layouts_page_id_unique").on(table.pageId),
    index("page_layouts_page_id_idx").on(table.pageId),
  ],
);

export const secrets = sqliteTable(
  "secrets",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    integrationId: text("integration_id")
      .notNull()
      .references(() => integrations.id, { onDelete: "cascade", onUpdate: "cascade" }),
    key: text("key").notNull(),
    /** Encrypted ciphertext only; never store plaintext secrets. */
    ciphertext: text("ciphertext").notNull(),
    createdAt: epochMillis("created_at").notNull(),
    updatedAt: epochMillis("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("secrets_integration_key_unique").on(table.integrationId, table.key),
    index("secrets_integration_id_idx").on(table.integrationId),
  ],
);

export const cacheEntries = sqliteTable(
  "cache_entries",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    cacheKey: text("cache_key").notNull(),
    widgetId: text("widget_id").references(() => widgets.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
    /** Cached widget payload; validated with Zod at the repository boundary. */
    payloadJson: text("payload_json").notNull(),
    fetchedAt: epochMillis("fetched_at").notNull(),
    staleAt: epochMillis("stale_at").notNull(),
    expiresAt: epochMillis("expires_at").notNull(),
    createdAt: epochMillis("created_at").notNull(),
    updatedAt: epochMillis("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("cache_entries_cache_key_unique").on(table.cacheKey),
    index("cache_entries_widget_id_idx").on(table.widgetId),
    index("cache_entries_expires_at_idx").on(table.expiresAt),
  ],
);

export const settings = sqliteTable(
  "settings",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade", onUpdate: "cascade" }),
    key: text("key").notNull(),
    /** Setting value; validated with Zod at the repository boundary. */
    valueJson: text("value_json").notNull(),
    createdAt: epochMillis("created_at").notNull(),
    updatedAt: epochMillis("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("settings_user_key_unique").on(table.userId, table.key),
    index("settings_user_id_idx").on(table.userId),
  ],
);

/**
 * Persistent local todo items scoped to a dashboard widget instance and owner.
 * Instance ids come from page layout documents (typed widget UUIDs).
 */
export const todoItems = sqliteTable(
  "todo_items",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    ownerUserId: text("owner_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade", onUpdate: "cascade" }),
    instanceId: text("instance_id").notNull(),
    title: text("title").notNull(),
    completed: integer("completed", { mode: "boolean" }).notNull().default(false),
    /** ISO-8601 due timestamp, or null when unset. */
    dueAt: text("due_at"),
    sortOrder: integer("sort_order", { mode: "number" }).notNull().default(0),
    createdAt: epochMillis("created_at").notNull(),
    updatedAt: epochMillis("updated_at").notNull(),
  },
  (table) => [
    index("todo_items_owner_instance_idx").on(table.ownerUserId, table.instanceId),
    index("todo_items_instance_sort_idx").on(table.instanceId, table.sortOrder),
  ],
);

/**
 * First-run setup token singleton. Stores only the SHA-256 hash of the opaque token.
 * At most one active row should exist while setup is required.
 */
export const setupTokens = sqliteTable(
  "setup_tokens",
  {
    id: text("id").primaryKey(),
    tokenHash: text("token_hash").notNull(),
    createdAt: epochMillis("created_at").notNull(),
    expiresAt: epochMillis("expires_at").notNull(),
  },
  (table) => [
    uniqueIndex("setup_tokens_token_hash_unique").on(table.tokenHash),
    index("setup_tokens_expires_at_idx").on(table.expiresAt),
  ],
);

export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  dashboards: many(dashboards),
  integrations: many(integrations),
  settings: many(settings),
  todoItems: many(todoItems),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const dashboardsRelations = relations(dashboards, ({ one, many }) => ({
  owner: one(users, { fields: [dashboards.ownerUserId], references: [users.id] }),
  pages: many(pages),
}));

export const pagesRelations = relations(pages, ({ one, many }) => ({
  dashboard: one(dashboards, { fields: [pages.dashboardId], references: [dashboards.id] }),
  widgets: many(widgets),
  layouts: many(widgetLayouts),
  pageLayout: one(pageLayouts, { fields: [pages.id], references: [pageLayouts.pageId] }),
}));

export const pageLayoutsRelations = relations(pageLayouts, ({ one }) => ({
  page: one(pages, { fields: [pageLayouts.pageId], references: [pages.id] }),
}));

export const integrationsRelations = relations(integrations, ({ one, many }) => ({
  user: one(users, { fields: [integrations.userId], references: [users.id] }),
  secrets: many(secrets),
  widgets: many(widgets),
}));

export const widgetsRelations = relations(widgets, ({ one, many }) => ({
  page: one(pages, { fields: [widgets.pageId], references: [pages.id] }),
  integration: one(integrations, {
    fields: [widgets.integrationId],
    references: [integrations.id],
  }),
  layout: one(widgetLayouts, { fields: [widgets.id], references: [widgetLayouts.widgetId] }),
  cacheEntries: many(cacheEntries),
}));

export const widgetLayoutsRelations = relations(widgetLayouts, ({ one }) => ({
  widget: one(widgets, { fields: [widgetLayouts.widgetId], references: [widgets.id] }),
  page: one(pages, { fields: [widgetLayouts.pageId], references: [pages.id] }),
}));

export const secretsRelations = relations(secrets, ({ one }) => ({
  integration: one(integrations, {
    fields: [secrets.integrationId],
    references: [integrations.id],
  }),
}));

export const cacheEntriesRelations = relations(cacheEntries, ({ one }) => ({
  widget: one(widgets, { fields: [cacheEntries.widgetId], references: [widgets.id] }),
}));

export const settingsRelations = relations(settings, ({ one }) => ({
  user: one(users, { fields: [settings.userId], references: [users.id] }),
}));

export const todoItemsRelations = relations(todoItems, ({ one }) => ({
  owner: one(users, { fields: [todoItems.ownerUserId], references: [users.id] }),
}));

/** Schema object passed to drizzle() for typed queries. */
export const schema = {
  users,
  sessions,
  dashboards,
  pages,
  widgets,
  widgetLayouts,
  pageLayouts,
  integrations,
  secrets,
  cacheEntries,
  settings,
  todoItems,
  setupTokens,
  usersRelations,
  sessionsRelations,
  dashboardsRelations,
  pagesRelations,
  pageLayoutsRelations,
  integrationsRelations,
  widgetsRelations,
  widgetLayoutsRelations,
  secretsRelations,
  cacheEntriesRelations,
  settingsRelations,
  todoItemsRelations,
};
