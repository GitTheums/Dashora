import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const SECRET_FILE_ENV_MAP: Record<string, string> = {
  SECRETS_ENCRYPTION_KEY_FILE: "SECRETS_ENCRYPTION_KEY",
};

/**
 * Loads a dotenv-style file into process.env without overriding existing values.
 * Does not log file contents.
 */
export function loadEnvFile(filePath = resolve(process.cwd(), ".env")): void {
  if (!existsSync(filePath)) {
    return;
  }

  const content = readFileSync(filePath, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!Object.hasOwn(process.env, key)) {
      process.env[key] = value;
    }
  }
}

/**
 * Resolves `*_FILE` environment variables (Docker/Podman secret mounts) into their target
 * variable before schema validation. Fails closed: a missing/unreadable file or a conflicting
 * direct value throws rather than silently falling back, since this only guards secret material.
 */
export function resolveSecretFileEnvVars(env: NodeJS.ProcessEnv = process.env): void {
  for (const [fileVar, targetVar] of Object.entries(SECRET_FILE_ENV_MAP)) {
    const filePath = env[fileVar];
    if (!filePath) {
      continue;
    }
    if (env[targetVar]) {
      throw new Error(
        `Both ${targetVar} and ${fileVar} are set. Set only one to avoid ambiguous configuration.`,
      );
    }
    let content: string;
    try {
      content = readFileSync(filePath, "utf8");
    } catch (error) {
      throw new Error(
        `Could not read ${fileVar} at "${filePath}": ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    const trimmed = content.trim();
    if (!trimmed) {
      throw new Error(`${fileVar} at "${filePath}" is empty.`);
    }
    env[targetVar] = trimmed;
  }
}
