import type { DashoraDatabase } from "../client.js";
import { createCacheEntriesRepository } from "./cache-entries.js";
import { createDashboardsRepository } from "./dashboards.js";
import { createIntegrationsRepository } from "./integrations.js";
import { createPageLayoutsRepository } from "./page-layouts.js";
import { createPagesRepository } from "./pages.js";
import { createSecretsRepository } from "./secrets.js";
import { createSessionsRepository } from "./sessions.js";
import { createSettingsRepository } from "./settings.js";
import { createSetupTokensRepository } from "./setup-tokens.js";
import { createTodoItemsRepository } from "./todo-items.js";
import { createUsersRepository } from "./users.js";
import { createWidgetLayoutsRepository } from "./widget-layouts.js";
import { createWidgetsRepository } from "./widgets.js";

export type Repositories = {
  users: ReturnType<typeof createUsersRepository>;
  sessions: ReturnType<typeof createSessionsRepository>;
  dashboards: ReturnType<typeof createDashboardsRepository>;
  pages: ReturnType<typeof createPagesRepository>;
  widgets: ReturnType<typeof createWidgetsRepository>;
  widgetLayouts: ReturnType<typeof createWidgetLayoutsRepository>;
  pageLayouts: ReturnType<typeof createPageLayoutsRepository>;
  integrations: ReturnType<typeof createIntegrationsRepository>;
  secrets: ReturnType<typeof createSecretsRepository>;
  cacheEntries: ReturnType<typeof createCacheEntriesRepository>;
  settings: ReturnType<typeof createSettingsRepository>;
  setupTokens: ReturnType<typeof createSetupTokensRepository>;
  todoItems: ReturnType<typeof createTodoItemsRepository>;
};

/** Build the persistence layer used by HTTP routes — never run SQL in route handlers. */
export function createRepositories(db: DashoraDatabase): Repositories {
  return {
    users: createUsersRepository(db),
    sessions: createSessionsRepository(db),
    dashboards: createDashboardsRepository(db),
    pages: createPagesRepository(db),
    widgets: createWidgetsRepository(db),
    widgetLayouts: createWidgetLayoutsRepository(db),
    pageLayouts: createPageLayoutsRepository(db),
    integrations: createIntegrationsRepository(db),
    secrets: createSecretsRepository(db),
    cacheEntries: createCacheEntriesRepository(db),
    settings: createSettingsRepository(db),
    setupTokens: createSetupTokensRepository(db),
    todoItems: createTodoItemsRepository(db),
  };
}

export {
  createCacheEntriesRepository,
  createDashboardsRepository,
  createIntegrationsRepository,
  createPageLayoutsRepository,
  createPagesRepository,
  createSecretsRepository,
  createSessionsRepository,
  createSettingsRepository,
  createSetupTokensRepository,
  createTodoItemsRepository,
  createUsersRepository,
  createWidgetLayoutsRepository,
  createWidgetsRepository,
};
