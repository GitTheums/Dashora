import { z } from "zod";
import { githubOwnerSchema, githubRepoNameSchema, newGithubRepoEntryId } from "./repo-entry.js";

export { githubOwnerSchema, githubRepoNameSchema, newGithubRepoEntryId };

export const githubReleasesLayoutSchema = z.enum(["compact", "detailed"]);
export type GithubReleasesLayout = z.infer<typeof githubReleasesLayoutSchema>;

export const githubReleaseRepoConfigSchema = z.object({
  id: z.string().uuid(),
  owner: githubOwnerSchema,
  repo: githubRepoNameSchema,
});

export type GithubReleaseRepoConfig = z.infer<typeof githubReleaseRepoConfigSchema>;

export const githubReleasesConfigSchema = z.object({
  repositories: z.array(githubReleaseRepoConfigSchema).max(10).default([]),
  includePrereleases: z.boolean().default(false),
  compactMode: z.boolean().default(false),
  layout: githubReleasesLayoutSchema.default("detailed"),
  /** Linked GitHub integration id; optional for public repositories. */
  credentialId: z.string().uuid().nullable().optional().default(null),
  openInNewTab: z.boolean().default(true),
  enabled: z.boolean().default(true),
});

export type GithubReleasesConfig = z.infer<typeof githubReleasesConfigSchema>;

export const GITHUB_RELEASES_DEFAULT_CONFIG: GithubReleasesConfig =
  githubReleasesConfigSchema.parse({});

export const githubReleaseRepoStatusSchema = z.enum(["ok", "empty", "error"]);
export type GithubReleaseRepoStatus = z.infer<typeof githubReleaseRepoStatusSchema>;

export const githubReleaseItemSchema = z.object({
  id: z.string().min(1).max(80),
  repoId: z.string().uuid(),
  owner: z.string().min(1).max(39),
  repo: z.string().min(1).max(100),
  fullName: z.string().min(3).max(140),
  tagName: z.string().min(1).max(120),
  name: z.string().min(1).max(200),
  htmlUrl: z.string().url(),
  publishedAt: z.string().datetime({ offset: true }).nullable(),
  prerelease: z.boolean(),
  draft: z.boolean(),
});

export type GithubReleaseItem = z.infer<typeof githubReleaseItemSchema>;

export const githubReleaseRepoResultSchema = z.object({
  id: z.string().uuid(),
  owner: z.string().min(1).max(39),
  repo: z.string().min(1).max(100),
  fullName: z.string().min(3).max(140),
  status: githubReleaseRepoStatusSchema,
  message: z.string().max(240).optional(),
  cacheStatus: z.enum(["hit", "miss", "stale", "bypass"]).optional(),
});

export type GithubReleaseRepoResult = z.infer<typeof githubReleaseRepoResultSchema>;

export const githubReleasesDataSchema = z.object({
  compactMode: z.boolean(),
  layout: githubReleasesLayoutSchema,
  includePrereleases: z.boolean(),
  openInNewTab: z.boolean(),
  releases: z.array(githubReleaseItemSchema).max(10),
  repositories: z.array(githubReleaseRepoResultSchema).max(10),
  failedRepoCount: z.number().int().nonnegative(),
  fetchedAt: z.string().datetime({ offset: true }),
  authenticated: z.boolean(),
});

export type GithubReleasesData = z.infer<typeof githubReleasesDataSchema>;
