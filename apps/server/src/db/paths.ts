import { mkdirSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import { DEFAULT_DASHORA_DATA_DIR } from "@dashora/shared";

export const DATABASE_FILE_NAME = "dashora.sqlite";

export function resolveDataDir(
  dataDir: string = DEFAULT_DASHORA_DATA_DIR,
  cwd: string = process.cwd(),
): string {
  const trimmed = dataDir.trim();
  if (trimmed.length === 0) {
    throw new Error("DASHORA_DATA_DIR must not be empty");
  }
  return isAbsolute(trimmed) ? trimmed : resolve(cwd, trimmed);
}

export function resolveDatabasePath(
  dataDir: string = DEFAULT_DASHORA_DATA_DIR,
  cwd: string = process.cwd(),
): string {
  // Prefer join so Unix-style absolute defaults like `/data` stay stable on Windows hosts.
  return join(resolveDataDir(dataDir, cwd), DATABASE_FILE_NAME);
}

export function ensureDataDir(dataDir: string): string {
  mkdirSync(dataDir, { recursive: true });
  return dataDir;
}
