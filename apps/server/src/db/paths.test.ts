import { join } from "node:path";
import { DEFAULT_DASHORA_DATA_DIR } from "@dashora/shared";
import { describe, expect, it } from "vitest";
import { JsonValidationError, parseJsonColumn, serializeJson } from "./json.js";
import { jsonObjectSchema, jsonValueSchema } from "./json.js";
import { DATABASE_FILE_NAME, resolveDataDir, resolveDatabasePath } from "./paths.js";
import { assertEpochMillis, nowEpochMillis } from "./timestamps.js";

describe("paths", () => {
  it("defaults to the Docker volume data directory", () => {
    expect(resolveDataDir()).toBe(DEFAULT_DASHORA_DATA_DIR);
    expect(resolveDatabasePath()).toBe(join(DEFAULT_DASHORA_DATA_DIR, DATABASE_FILE_NAME));
  });

  it("resolves relative DASHORA_DATA_DIR against cwd", () => {
    const cwd = join(process.cwd(), "apps", "server");
    expect(resolveDataDir("./data", cwd)).toBe(join(cwd, "data"));
    expect(resolveDatabasePath("./data", cwd)).toBe(join(cwd, "data", DATABASE_FILE_NAME));
  });
});

describe("timestamps", () => {
  it("returns integer epoch millis", () => {
    const value = nowEpochMillis(new Date("2026-07-30T08:00:00.000Z"));
    expect(value).toBe(Date.parse("2026-07-30T08:00:00.000Z"));
    expect(assertEpochMillis(value, "createdAt")).toBe(value);
  });

  it("rejects non-integer timestamps", () => {
    expect(() => assertEpochMillis(1.5, "createdAt")).toThrow(/createdAt/);
    expect(() => assertEpochMillis(-1, "createdAt")).toThrow(/createdAt/);
  });
});

describe("json helpers", () => {
  it("serializes and parses validated JSON objects", () => {
    const encoded = serializeJson(jsonObjectSchema, { timezone: "UTC" }, "config");
    expect(encoded).toBe('{"timezone":"UTC"}');
    expect(parseJsonColumn(jsonObjectSchema, encoded, "config")).toEqual({ timezone: "UTC" });
  });

  it("accepts nested json values", () => {
    const encoded = serializeJson(jsonValueSchema, [{ a: 1 }, null, true], "payload");
    expect(parseJsonColumn(jsonValueSchema, encoded, "payload")).toEqual([{ a: 1 }, null, true]);
  });

  it("rejects invalid JSON shapes at the boundary", () => {
    expect(() =>
      serializeJson(jsonObjectSchema, "nope" as unknown as Record<string, never>, "config"),
    ).toThrow(JsonValidationError);
    expect(() => parseJsonColumn(jsonObjectSchema, "[]", "config")).toThrow(JsonValidationError);
    expect(() => parseJsonColumn(jsonObjectSchema, "{", "config")).toThrow(/Invalid JSON text/);
  });
});
