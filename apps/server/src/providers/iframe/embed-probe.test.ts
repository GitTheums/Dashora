import { describe, expect, it } from "vitest";
import { evaluateEmbeddingHeaders } from "./embed-probe.js";

describe("evaluateEmbeddingHeaders", () => {
  it("detects X-Frame-Options denial", () => {
    expect(evaluateEmbeddingHeaders({ "x-frame-options": "DENY" }).embeddingRefused).toBe(true);
    expect(evaluateEmbeddingHeaders({ "x-frame-options": "SAMEORIGIN" }).embeddingRefused).toBe(
      true,
    );
  });

  it("detects CSP frame-ancestors restrictions", () => {
    expect(
      evaluateEmbeddingHeaders({
        "content-security-policy": "default-src 'self'; frame-ancestors 'none'",
      }).embeddingRefused,
    ).toBe(true);
    expect(
      evaluateEmbeddingHeaders({
        "content-security-policy": "frame-ancestors 'self'",
      }).embeddingRefused,
    ).toBe(true);
  });

  it("allows open framing", () => {
    expect(evaluateEmbeddingHeaders({}).embeddingRefused).toBe(false);
    expect(
      evaluateEmbeddingHeaders({
        "content-security-policy": "frame-ancestors *",
      }).embeddingRefused,
    ).toBe(false);
  });
});
