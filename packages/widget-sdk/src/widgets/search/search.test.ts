import { describe, expect, it } from "vitest";
import { REQUIRED_WIDGET_STATES } from "../../states.js";
import {
  SEARCH_DEFAULT_CONFIG,
  buildSearchUrl,
  searchConfigSchema,
  searchDefinition,
  searchProvider,
  validateSearchTemplate,
} from "./index.js";
import { matchesKeyboardShortcut, parseKeyboardShortcut } from "./keyboard.js";

describe("search definition", () => {
  it("covers every required runtime state", () => {
    expect(searchDefinition.states).toEqual(REQUIRED_WIDGET_STATES);
    expect(searchDefinition.id).toBe("search");
  });

  it("parses default config", () => {
    expect(searchConfigSchema.parse({})).toEqual(SEARCH_DEFAULT_CONFIG);
  });
});

describe("safe search URL generation", () => {
  it("accepts https templates with {query}", () => {
    expect(validateSearchTemplate("https://example.com/?q={query}")).toEqual({
      ok: true,
      template: "https://example.com/?q={query}",
    });
  });

  it("rejects javascript and missing placeholder", () => {
    expect(validateSearchTemplate("javascript:alert(1)").ok).toBe(false);
    expect(validateSearchTemplate("https://example.com/").ok).toBe(false);
  });

  it("encodes the query when building a URL", () => {
    expect(buildSearchUrl("https://duckduckgo.com/?q={query}", "hello world")).toBe(
      "https://duckduckgo.com/?q=hello%20world",
    );
    expect(buildSearchUrl("javascript:alert({query})", "x")).toBeNull();
  });
});

describe("search provider", () => {
  it("returns success for a preset engine", async () => {
    const result = await searchProvider.fetch({
      instanceId: "s1",
      config: SEARCH_DEFAULT_CONFIG,
    });
    expect(result.state).toBe("success");
    expect(result.data?.engineId).toBe("duckduckgo");
  });

  it("rejects unsafe custom templates at the schema boundary", () => {
    expect(() =>
      searchConfigSchema.parse({
        ...SEARCH_DEFAULT_CONFIG,
        engine: "custom",
        customTemplate: "javascript:alert({query})",
      }),
    ).toThrow();
  });

  it("returns disabled when enabled is false", async () => {
    const result = await searchProvider.fetch({
      instanceId: "s3",
      config: { ...SEARCH_DEFAULT_CONFIG, enabled: false },
    });
    expect(result.state).toBe("disabled");
  });
});

describe("keyboard shortcut parsing", () => {
  it("parses slash and modifier shortcuts", () => {
    expect(parseKeyboardShortcut("/")).toEqual({
      key: "/",
      ctrl: false,
      meta: false,
      alt: false,
      shift: false,
    });
    expect(parseKeyboardShortcut("Ctrl+K")).toMatchObject({ key: "k", ctrl: true });
  });

  it("matches KeyboardEvent-like objects", () => {
    const shortcut = parseKeyboardShortcut("Ctrl+K");
    expect(shortcut).not.toBeNull();
    if (!shortcut) {
      return;
    }
    expect(
      matchesKeyboardShortcut(
        {
          key: "k",
          ctrlKey: true,
          metaKey: false,
          altKey: false,
          shiftKey: false,
        } as KeyboardEvent,
        shortcut,
      ),
    ).toBe(true);
  });
});
