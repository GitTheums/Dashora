import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseServerEnv } from "@dashora/shared";
import { buildApp } from "./app.js";
import { openDatabaseFromDataDir } from "./db/client.js";
import { loadEnvFile } from "./load-env.js";

loadEnvFile();

const packageJsonPath = resolve(dirname(fileURLToPath(import.meta.url)), "../package.json");
const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as { version: string };

const env = parseServerEnv(process.env, { version: packageJson.version });

// Apply migrations before serving traffic (fail closed on migration errors).
const database = openDatabaseFromDataDir(env.DASHORA_DATA_DIR, { migrate: true });

const app = await buildApp({
  version: env.APP_VERSION,
  env,
  database,
  logger: {
    level: env.LOG_LEVEL,
  },
});

app.addHook("onClose", async () => {
  database.close();
});

try {
  await app.listen({ host: env.HOST, port: env.PORT });
  app.log.info({ databasePath: database.databasePath }, "SQLite ready");
} catch (error) {
  app.log.error(error);
  database.close();
  process.exit(1);
}
