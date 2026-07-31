import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { createDashoraUuid, isDashoraUuid } from "./uuid.js";

describe("createDashoraUuid", () => {
  it("returns a Zod-valid UUID when randomUUID is available", () => {
    const id = createDashoraUuid();
    expect(z.string().uuid().safeParse(id).success).toBe(true);
    expect(isDashoraUuid(id)).toBe(true);
  });

  it("returns distinct UUIDs on successive calls", () => {
    const a = createDashoraUuid();
    const b = createDashoraUuid();
    expect(a).not.toBe(b);
  });

  it("falls back to getRandomValues with a valid UUID shape", () => {
    const original = globalThis.crypto;
    const getRandomValues = vi.fn((bytes: Uint8Array) => {
      for (let i = 0; i < bytes.length; i += 1) {
        bytes[i] = (i * 17 + 3) % 256;
      }
      return bytes;
    });
    Object.defineProperty(globalThis, "crypto", {
      configurable: true,
      value: { getRandomValues },
    });
    try {
      const id = createDashoraUuid();
      expect(getRandomValues).toHaveBeenCalled();
      expect(z.string().uuid().safeParse(id).success).toBe(true);
      expect(id).not.toMatch(/^a[0-9a-f]{11}-/);
      expect(isDashoraUuid(id)).toBe(true);
    } finally {
      Object.defineProperty(globalThis, "crypto", {
        configurable: true,
        value: original,
      });
    }
  });

  it("rejects widget type slugs as UUIDs", () => {
    expect(isDashoraUuid("weather")).toBe(false);
    expect(isDashoraUuid("rss")).toBe(false);
    expect(isDashoraUuid("temp-1")).toBe(false);
  });
});
