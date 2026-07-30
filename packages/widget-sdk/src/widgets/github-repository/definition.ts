import { defineWidget } from "../../definition.js";
import { GITHUB_REPOSITORY_DEFAULT_CONFIG, githubRepositoryConfigSchema } from "./config.js";

export const GITHUB_REPOSITORY_WIDGET_ID = "github-repository" as const;

export const githubRepositoryDefinition = defineWidget({
  id: GITHUB_REPOSITORY_WIDGET_ID,
  name: "GitHub Repository",
  version: "1.0.0",
  schemaVersion: 1,
  description:
    "Stars, forks, open issues and pull requests, languages, and latest activity for a GitHub repository.",
  category: "development",
  icon: { name: "code", label: "GitHub Repository" },
  configSchema: githubRepositoryConfigSchema,
  defaultConfig: GITHUB_REPOSITORY_DEFAULT_CONFIG,
  defaultLayout: {
    colSpan: 4,
    rowSpan: 3,
    minColSpan: 3,
    minRowSpan: 2,
    maxColSpan: 8,
    maxRowSpan: 6,
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
    ttlSeconds: 120,
    staleWhileRevalidateSeconds: 900,
    varyByConfig: true,
    varyByCredential: true,
  },
  refresh: {
    defaultIntervalSeconds: 120,
    minManualIntervalSeconds: 15,
  },
});
