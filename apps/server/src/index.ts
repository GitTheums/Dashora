import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseServerEnv } from "@dashora/shared";
import { buildApp } from "./app.js";
import { startCacheMaintenance } from "./cache-maintenance.js";
import { openDatabaseFromDataDir } from "./db/client.js";
import { createRepositories } from "./db/repositories/index.js";
import { registerGracefulShutdown } from "./http/graceful-shutdown.js";
import { loadEnvFile, resolveSecretFileEnvVars } from "./load-env.js";

loadEnvFile();
resolveSecretFileEnvVars();

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

const repos = createRepositories(database.db);
const stopCacheMaintenance = startCacheMaintenance({
  repository: repos.cacheEntries,
  log: app.log,
});

app.addHook("onClose", async () => {
  stopCacheMaintenance();
  database.close();
});

registerGracefulShutdown(app);

try {
  await app.listen({ host: env.HOST, port: env.PORT });
  app.log.info({ databasePath: database.databasePath, port: env.PORT }, "SQLite ready");
} catch (error) {
  app.log.error(error);
  stopCacheMaintenance();
  database.close();
  process.exit(1);
}
