import { githubOwnerSchema, githubRepoNameSchema } from "../_shared/github-names.js";
import { newConfigEntryId } from "../_shared/ids.js";

export { githubOwnerSchema, githubRepoNameSchema };

export function newGithubRepoEntryId(): string {
  return newConfigEntryId();
}
