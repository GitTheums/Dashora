import { defineWidget } from "../../definition.js";
import { TODO_DEFAULT_CONFIG, todoConfigSchema } from "./config.js";

export const TODO_WIDGET_ID = "todo" as const;

export const todoDefinition = defineWidget({
  id: TODO_WIDGET_ID,
  name: "Todo",
  version: "1.0.0",
  schemaVersion: 1,
  description: "Persistent local tasks with due dates, reorder, and optimistic updates.",
  category: "productivity",
  icon: { name: "checklist", label: "Todo" },
  configSchema: todoConfigSchema,
  defaultConfig: TODO_DEFAULT_CONFIG,
  defaultLayout: {
    colSpan: 4,
    rowSpan: 3,
    minColSpan: 2,
    minRowSpan: 2,
    maxColSpan: 8,
    maxRowSpan: 10,
    tabletColSpan: 4,
    mobileColSpan: 4,
  },
  capabilities: {
    supportsManualRefresh: true,
    supportsTitleOverride: true,
    requiresIntegration: false,
    supportsDisable: true,
    hasSettings: true,
  },
  cache: {
    ttlSeconds: 15,
    staleWhileRevalidateSeconds: 60,
    varyByConfig: true,
    varyByCredential: false,
  },
  refresh: {
    defaultIntervalSeconds: 30,
    minManualIntervalSeconds: 2,
  },
});
