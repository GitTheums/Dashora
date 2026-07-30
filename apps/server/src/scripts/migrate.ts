import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseServerEnv } from "@dashora/shared";
import { openDatabaseFromDataDir } from "../db/client.js";
import { loadEnvFile } from "../load-env.js";

loadEnvFile();

const packageJsonPath = resolve(dirname(fileURLToPath(import.meta.url)), "../../package.json");
const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as { version: string };
const env = parseServerEnv(process.env, { version: packageJson.version });

const opened = openDatabaseFromDataDir(env.DASHORA_DATA_DIR, { migrate: true });

try {
  console.info(`Migrations applied to ${opened.databasePath}`);
} finally {
  opened.close();
}
