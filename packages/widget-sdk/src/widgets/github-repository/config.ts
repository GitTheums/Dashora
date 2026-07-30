import { z } from "zod";
import { githubOwnerSchema, githubRepoNameSchema } from "../_shared/github-names.js";

export const githubRepositoryLayoutSchema = z.enum(["compact", "detailed"]);
export type GithubRepositoryLayout = z.infer<typeof githubRepositoryLayoutSchema>;

export const githubRepositoryConfigSchema = z.object({
  owner: githubOwnerSchema.or(z.literal("")).default(""),
  repo: githubRepoNameSchema.or(z.literal("")).default(""),
  /** Linked GitHub integration id; optional for public repositories. */
  credentialId: z.string().uuid().nullable().optional().default(null),
  layout: githubRepositoryLayoutSchema.default("detailed"),
  showDescription: z.boolean().default(true),
  showLanguages: z.boolean().default(true),
  enabled: z.boolean().default(true),
});

export type GithubRepositoryConfig = z.infer<typeof githubRepositoryConfigSchema>;

export const GITHUB_REPOSITORY_DEFAULT_CONFIG: GithubRepositoryConfig =
  githubRepositoryConfigSchema.parse({});

export const githubLanguageShareSchema = z.object({
  name: z.string().min(1).max(80),
  bytes: z.number().int().nonnegative(),
  percentage: z.number().min(0).max(100),
});

export type GithubLanguageShare = z.infer<typeof githubLanguageShareSchema>;

export const githubRepositoryDataSchema = z.object({
  owner: z.string().min(1).max(39),
  name: z.string().min(1).max(100),
  fullName: z.string().min(3).max(140),
  description: z.string().max(500).nullable(),
  htmlUrl: z.string().url(),
  stars: z.number().int().nonnegative(),
  forks: z.number().int().nonnegative(),
  openIssues: z.number().int().nonnegative(),
  openPullRequests: z.number().int().nonnegative(),
  primaryLanguage: z.string().max(80).nullable(),
  languages: z.array(githubLanguageShareSchema).max(20),
  pushedAt: z.string().datetime({ offset: true }).nullable(),
  updatedAt: z.string().datetime({ offset: true }).nullable(),
  latestActivitySummary: z.string().min(1).max(160),
  isPrivate: z.boolean(),
  layout: githubRepositoryLayoutSchema,
  showDescription: z.boolean(),
  showLanguages: z.boolean(),
  providerId: z.string().min(1).max(64),
  fetchedAt: z.string().datetime({ offset: true }),
  authenticated: z.boolean(),
});

export type GithubRepositoryData = z.infer<typeof githubRepositoryDataSchema>;

export function isGithubRepositoryConfigured(config: GithubRepositoryConfig): boolean {
  return config.owner.trim().length > 0 && config.repo.trim().length > 0;
}
