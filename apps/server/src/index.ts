import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseServerEnv } from "@dashora/shared";
import { buildApp } from "./app.js";
import { loadEnvFile } from "./load-env.js";

loadEnvFile();

const packageJsonPath = resolve(dirname(fileURLToPath(import.meta.url)), "../package.json");
const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as { version: string };

const env = parseServerEnv(process.env, { version: packageJson.version });

const app = await buildApp({
  version: env.APP_VERSION,
  logger: {
    level: env.LOG_LEVEL,
  },
  trustProxy: env.TRUST_PROXY,
  corsOrigin: env.CORS_ORIGIN,
});

try {
  await app.listen({ host: env.HOST, port: env.PORT });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
