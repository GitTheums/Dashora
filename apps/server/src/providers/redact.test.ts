import { describe, expect, it } from "vitest";
import { redactHeaders, redactUrl, safeUrlLabel } from "./redact.js";

describe("provider redaction", () => {
  it("redacts authorization and cookie headers", () => {
    const redacted = redactHeaders({
      Authorization: "Bearer super-secret",
      "X-Api-Key": "abc",
      "Content-Type": "application/json",
    });
    expect(redacted["Authorization"]).toBe("[Redacted]");
    expect(redacted["X-Api-Key"]).toBe("[Redacted]");
    expect(redacted["Content-Type"]).toBe("application/json");
  });

  it("redacts sensitive query parameters", () => {
    const url = redactUrl("https://example.test/feed?token=secret&page=1&api_key=xyz");
    expect(url).toContain("token=%5BRedacted%5D");
    expect(url).toContain("api_key=%5BRedacted%5D");
    expect(url).toContain("page=1");
    expect(url).not.toContain("secret");
    expect(url).not.toContain("xyz");
  });

  it("strips query and credentials from safe labels", () => {
    expect(safeUrlLabel("https://user:pass@example.test/path?token=abc")).toBe(
      "https://example.test/path",
    );
  });
});
