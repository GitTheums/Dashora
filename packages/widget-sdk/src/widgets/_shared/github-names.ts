import { z } from "zod";

/**
 * GitHub username / org login rules (simplified for validation).
 * @see https://docs.github.com/en/enterprise-cloud@latest/admin/managing-iam/iam-configuration-reference/username-considerations-for-external-authentication
 */
const GITHUB_OWNER_PATTERN = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/;

/**
 * Repository name: letters, digits, hyphens, underscores, and dots.
 */
const GITHUB_REPO_PATTERN = /^[a-zA-Z0-9._-]{1,100}$/;

export const githubOwnerSchema = z
  .string()
  .trim()
  .min(1, "Owner is required")
  .max(39, "Owner must be at most 39 characters")
  .regex(GITHUB_OWNER_PATTERN, "Enter a valid GitHub owner or organization name");

export const githubRepoNameSchema = z
  .string()
  .trim()
  .min(1, "Repository is required")
  .max(100, "Repository name must be at most 100 characters")
  .regex(GITHUB_REPO_PATTERN, "Enter a valid GitHub repository name")
  .refine((value) => value !== "." && value !== "..", "Repository name is invalid");

export const githubRepoRefSchema = z.object({
  owner: githubOwnerSchema,
  repo: githubRepoNameSchema,
});

export type GithubRepoRef = z.infer<typeof githubRepoRefSchema>;

export function formatGithubFullName(owner: string, repo: string): string {
  return `${owner}/${repo}`;
}

export function parseGithubFullName(value: string): GithubRepoRef | null {
  const trimmed = value.trim();
  const slash = trimmed.indexOf("/");
  if (slash <= 0 || slash === trimmed.length - 1) {
    return null;
  }
  const owner = trimmed.slice(0, slash);
  const repo = trimmed.slice(slash + 1);
  if (repo.includes("/")) {
    return null;
  }
  const parsed = githubRepoRefSchema.safeParse({ owner, repo });
  return parsed.success ? parsed.data : null;
}
