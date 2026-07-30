import { defineWidget } from "../../definition.js";
import { GITHUB_RELEASES_DEFAULT_CONFIG, githubReleasesConfigSchema } from "./config.js";

export const GITHUB_RELEASES_WIDGET_ID = "github-releases" as const;

export const githubReleasesDefinition = defineWidget({
  id: GITHUB_RELEASES_WIDGET_ID,
  name: "GitHub Releases",
  version: "1.0.0",
  schemaVersion: 1,
  description:
    "Latest releases across multiple GitHub repositories, with optional prereleases and compact layout.",
  category: "development",
  icon: { name: "tag", label: "GitHub Releases" },
  configSchema: githubReleasesConfigSchema,
  defaultConfig: GITHUB_RELEASES_DEFAULT_CONFIG,
  defaultLayout: {
    colSpan: 4,
    rowSpan: 3,
    minColSpan: 3,
    minRowSpan: 2,
    maxColSpan: 8,
    maxRowSpan: 8,
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
    ttlSeconds: 180,
    staleWhileRevalidateSeconds: 1200,
    varyByConfig: true,
    varyByCredential: true,
  },
  refresh: {
    defaultIntervalSeconds: 180,
    minManualIntervalSeconds: 15,
  },
});
