import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadEnvFile, resolveSecretFileEnvVars } from "./load-env.js";

const trackedKeys = new Set<string>();

afterEach(() => {
  for (const key of trackedKeys) {
    Reflect.deleteProperty(process.env, key);
  }
  trackedKeys.clear();
});

describe("loadEnvFile", () => {
  it("loads missing keys from a dotenv file", () => {
    const dir = mkdtempSync(join(tmpdir(), "dashora-env-"));
    const filePath = join(dir, ".env");
    writeFileSync(filePath, "DASHORA_TEST_KEY=from-file\n# comment\n", "utf8");

    trackedKeys.add("DASHORA_TEST_KEY");
    Reflect.deleteProperty(process.env, "DASHORA_TEST_KEY");
    loadEnvFile(filePath);
    expect(process.env["DASHORA_TEST_KEY"]).toBe("from-file");
  });

  it("does not override existing environment values", () => {
    const dir = mkdtempSync(join(tmpdir(), "dashora-env-"));
    const filePath = join(dir, ".env");
    writeFileSync(filePath, "DASHORA_TEST_KEY=from-file\n", "utf8");

    trackedKeys.add("DASHORA_TEST_KEY");
    process.env["DASHORA_TEST_KEY"] = "already-set";
    loadEnvFile(filePath);
    expect(process.env["DASHORA_TEST_KEY"]).toBe("already-set");
  });
});

describe("resolveSecretFileEnvVars", () => {
  const KEY = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef".slice(0, 64);

  it("loads the target variable from the referenced file, trimmed", () => {
    const dir = mkdtempSync(join(tmpdir(), "dashora-secret-"));
    const filePath = join(dir, "key");
    writeFileSync(filePath, `${KEY}\n`, "utf8");

    const env: NodeJS.ProcessEnv = { SECRETS_ENCRYPTION_KEY_FILE: filePath };
    resolveSecretFileEnvVars(env);
    expect(env["SECRETS_ENCRYPTION_KEY"]).toBe(KEY);
  });

  it("does nothing when the file variable is not set", () => {
    const env: NodeJS.ProcessEnv = {};
    resolveSecretFileEnvVars(env);
    expect(env["SECRETS_ENCRYPTION_KEY"]).toBeUndefined();
  });

  it("throws when both the direct value and the file variable are set", () => {
    const dir = mkdtempSync(join(tmpdir(), "dashora-secret-"));
    const filePath = join(dir, "key");
    writeFileSync(filePath, KEY, "utf8");

    const env: NodeJS.ProcessEnv = {
      SECRETS_ENCRYPTION_KEY: KEY,
      SECRETS_ENCRYPTION_KEY_FILE: filePath,
    };
    expect(() => resolveSecretFileEnvVars(env)).toThrow(/ambiguous/i);
  });

  it("throws when the referenced file does not exist", () => {
    const env: NodeJS.ProcessEnv = {
      SECRETS_ENCRYPTION_KEY_FILE: join(tmpdir(), "dashora-does-not-exist", "key"),
    };
    expect(() => resolveSecretFileEnvVars(env)).toThrow();
  });

  it("throws when the referenced file is empty", () => {
    const dir = mkdtempSync(join(tmpdir(), "dashora-secret-"));
    const filePath = join(dir, "key");
    writeFileSync(filePath, "   \n", "utf8");

    const env: NodeJS.ProcessEnv = { SECRETS_ENCRYPTION_KEY_FILE: filePath };
    expect(() => resolveSecretFileEnvVars(env)).toThrow(/empty/i);
  });
});
