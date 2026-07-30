import { describe, expect, it } from "vitest";
import { REQUIRED_WIDGET_STATES } from "../../states.js";
import {
  BOOKMARKS_DEFAULT_CONFIG,
  bookmarksConfigSchema,
  bookmarksDefinition,
  bookmarksProvider,
  reorderBookmarkItems,
  resolveBookmarksData,
} from "./index.js";

const sampleGroup = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Work",
  color: "primary" as const,
  items: [
    {
      id: "22222222-2222-4222-8222-222222222221",
      title: "Docs",
      url: "https://example.com/docs",
      description: "Internal docs",
      icon: "book" as const,
    },
    {
      id: "22222222-2222-4222-8222-222222222222",
      title: "Mail",
      url: "https://example.com/mail",
      description: "",
      icon: "mail" as const,
    },
  ],
};

describe("bookmarks definition", () => {
  it("covers every required runtime state", () => {
    expect(bookmarksDefinition.states).toEqual(REQUIRED_WIDGET_STATES);
    expect(bookmarksDefinition.id).toBe("bookmarks");
  });

  it("parses default config", () => {
    expect(bookmarksConfigSchema.parse({})).toEqual(BOOKMARKS_DEFAULT_CONFIG);
  });

  it("rejects non-http bookmark URLs", () => {
    expect(() =>
      bookmarksConfigSchema.parse({
        groups: [
          {
            ...sampleGroup,
            items: [{ ...sampleGroup.items[0], url: "javascript:alert(1)" }],
          },
        ],
      }),
    ).throws();
  });
});

describe("bookmarks helpers", () => {
  it("reorders items inside a group", () => {
    const next = reorderBookmarkItems([sampleGroup], sampleGroup.id, 0, 1);
    expect(next[0]?.items.map((item) => item.title)).toEqual(["Mail", "Docs"]);
  });

  it("counts items for empty detection", () => {
    expect(resolveBookmarksData(BOOKMARKS_DEFAULT_CONFIG).totalItems).toBe(0);
    expect(
      resolveBookmarksData({ ...BOOKMARKS_DEFAULT_CONFIG, groups: [sampleGroup] }).totalItems,
    ).toBe(2);
  });
});

describe("bookmarks provider", () => {
  it("returns empty when there are no links", async () => {
    const result = await bookmarksProvider.fetch({
      instanceId: "b1",
      config: BOOKMARKS_DEFAULT_CONFIG,
    });
    expect(result.state).toBe("empty");
  });

  it("returns success when links exist", async () => {
    const result = await bookmarksProvider.fetch({
      instanceId: "b2",
      config: { ...BOOKMARKS_DEFAULT_CONFIG, groups: [sampleGroup] },
    });
    expect(result.state).toBe("success");
    expect(result.data?.totalItems).toBe(2);
  });
});
