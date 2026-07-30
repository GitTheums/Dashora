import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { REQUIRED_WIDGET_STATES } from "../../states.js";
import { BOOKMARKS_DEFAULT_CONFIG, type BookmarksData } from "./config.js";
import { BookmarksRenderer } from "./renderer.js";
import { BookmarksSettings } from "./settings.js";

const sampleData: BookmarksData = {
  groups: [
    {
      id: "11111111-1111-4111-8111-111111111111",
      name: "Work",
      color: "primary",
      items: [
        {
          id: "22222222-2222-4222-8222-222222222221",
          title: "Docs",
          url: "https://example.com/docs",
          description: "Internal docs",
          icon: "book",
        },
      ],
    },
  ],
  openInNewTab: true,
  showDescriptions: true,
  totalItems: 1,
};

afterEach(() => {
  cleanup();
});

describe("BookmarksRenderer", () => {
  it.each(REQUIRED_WIDGET_STATES)("renders state=%s", (state) => {
    render(
      <BookmarksRenderer
        instanceId="1"
        title="Bookmarks"
        config={BOOKMARKS_DEFAULT_CONFIG}
        state={state}
        {...(state === "success" || state === "stale" || state === "refreshing"
          ? { data: sampleData }
          : {})}
        message={`msg-${state}`}
      />,
    );
    expect(document.querySelector(`[data-widget="bookmarks"][data-state="${state}"]`)).toBeTruthy();
  });

  it("renders bookmark links in success state", () => {
    render(
      <BookmarksRenderer
        instanceId="1"
        title="Bookmarks"
        config={BOOKMARKS_DEFAULT_CONFIG}
        state="success"
        data={sampleData}
      />,
    );
    expect(screen.getByRole("link", { name: /Docs/i })).toBeTruthy();
  });
});

describe("BookmarksSettings", () => {
  it("renders open-in-new-tab control", () => {
    render(
      <BookmarksSettings
        instanceId="1"
        config={BOOKMARKS_DEFAULT_CONFIG}
        onChange={() => undefined}
      />,
    );
    expect(screen.getByLabelText("Open links in a new tab")).toBeTruthy();
  });
});
