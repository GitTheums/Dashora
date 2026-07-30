import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadEnvFile } from "./load-env.js";

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
