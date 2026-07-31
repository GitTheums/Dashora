import { describe, expect, it } from "vitest";
import { sanitizeHttpUrl, stripHtmlToText } from "./sanitize.js";

describe("stripHtmlToText — bypass resistance", () => {
  it("strips well-formed script/style tags and their content", () => {
    expect(stripHtmlToText("<script>alert(1)</script><p>Hi &amp; bye</p>")).toBe("Hi & bye");
    expect(stripHtmlToText("<style>body{color:red}</style>Visible text")).toBe("Visible text");
  });

  it("does not resurrect an entity-encoded tag as a literal tag string", () => {
    // If entities were decoded *after* tag-stripping (the historical bug), this would leak a
    // literal "<script>alert(1)</script>" string into the output.
    const result = stripHtmlToText("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(result).not.toContain("<script>");
    expect(result).not.toContain("<");
    expect(result).toBe("");
  });

  it("does not resurrect an entity-encoded img/onerror payload", () => {
    const result = stripHtmlToText("&lt;img src=x onerror=alert(1)&gt;Hello&lt;/img&gt;");
    expect(result).not.toContain("<img");
    expect(result).not.toContain("<");
    expect(result).toContain("Hello");
  });

  it("strips an unterminated/malformed script tag without leaking its opening tag", () => {
    // No closing </script> — the script/style regex won't match, but the generic tag-strip
    // regex must still remove the bare opening tag so it isn't visible as text.
    const result = stripHtmlToText("<script>alert(1)");
    expect(result).not.toContain("<script>");
  });

  it("strips nested/malformed HTML comments", () => {
    const result = stripHtmlToText("<!--<script>alert(1)</script>-->Visible");
    expect(result).not.toContain("<script>");
    expect(result).not.toContain("alert(1)");
    expect(result.trim()).toBe("Visible");
  });

  it("collapses excessive whitespace left behind by stripped tags", () => {
    expect(stripHtmlToText("<div>  <span>Hi</span>   <b>there</b>  </div>")).toBe("Hi there");
  });

  it("truncates long content with an ellipsis at the requested max length", () => {
    const long = "a".repeat(600);
    const result = stripHtmlToText(long, 50);
    expect(result.length).toBe(50);
    expect(result.endsWith("…")).toBe(true);
  });

  it("returns an empty string for nullish or empty input", () => {
    expect(stripHtmlToText(null)).toBe("");
    expect(stripHtmlToText(undefined)).toBe("");
    expect(stripHtmlToText("")).toBe("");
  });

  it("decodes numeric character references safely and rejects out-of-range code points", () => {
    expect(stripHtmlToText("&#65;&#66;&#67;")).toBe("ABC");
    expect(stripHtmlToText("&#x41;&#x42;")).toBe("AB");
    // Out-of-range / invalid code points must not throw and must not be echoed back raw.
    expect(() => stripHtmlToText("&#99999999;")).not.toThrow();
  });
});

describe("sanitizeHttpUrl — bypass resistance", () => {
  it("rejects javascript: and data: URL schemes", () => {
    expect(sanitizeHttpUrl("javascript:alert(1)")).toBeNull();
    expect(sanitizeHttpUrl("JavaScript:alert(1)")).toBeNull();
    expect(sanitizeHttpUrl("data:text/html,<script>alert(1)</script>")).toBeNull();
    expect(sanitizeHttpUrl("vbscript:msgbox(1)")).toBeNull();
  });

  it("rejects credentialed URLs", () => {
    expect(sanitizeHttpUrl("https://user:pass@example.com")).toBeNull();
    expect(sanitizeHttpUrl("http://attacker@example.com")).toBeNull();
  });

  it("rejects URLs containing control characters", () => {
    expect(sanitizeHttpUrl("https://example.com/\u0000path")).toBeNull();
    expect(sanitizeHttpUrl("https://example.com/\npath")).toBeNull();
    expect(sanitizeHttpUrl("https://example.com/\tpath")).toBeNull();
  });

  it("rejects non-URL garbage and relative paths without throwing", () => {
    expect(sanitizeHttpUrl("not a url")).toBeNull();
    expect(sanitizeHttpUrl("/relative/path")).toBeNull();
    expect(sanitizeHttpUrl("//example.com/protocol-relative")).toBeNull();
  });

  it("accepts well-formed absolute http(s) URLs", () => {
    expect(sanitizeHttpUrl("https://example.com/ok?query=1#frag")).toBe(
      "https://example.com/ok?query=1#frag",
    );
    expect(sanitizeHttpUrl("http://example.com/plain")).toBe("http://example.com/plain");
  });

  it("returns null for nullish or blank input", () => {
    expect(sanitizeHttpUrl(null)).toBeNull();
    expect(sanitizeHttpUrl(undefined)).toBeNull();
    expect(sanitizeHttpUrl("   ")).toBeNull();
  });
});
