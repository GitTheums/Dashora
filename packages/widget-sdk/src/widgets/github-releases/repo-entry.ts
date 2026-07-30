import { githubOwnerSchema, githubRepoNameSchema } from "../_shared/github-names.js";

export { githubOwnerSchema, githubRepoNameSchema };

export function newGithubRepoEntryId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `a${Date.now().toString(16).padStart(11, "0")}-1111-4111-8111-${Math.floor(
    Math.random() * 1e12,
  )
    .toString(16)
    .padStart(12, "0")}`;
}
