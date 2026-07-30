import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { REQUIRED_WIDGET_STATES } from "../../states.js";
import { RSS_DEFAULT_CONFIG, type RssData } from "./config.js";
import { RssRenderer } from "./renderer.js";
import { RssSettings } from "./settings.js";

const sampleData: RssData = {
  layout: "detailed",
  showThumbnails: true,
  openInNewTab: true,
  failedFeedCount: 0,
  fetchedAt: "2026-07-30T12:00:00.000Z",
  feeds: [
    {
      id: "11111111-1111-4111-8111-111111111111",
      url: "https://example.test/feed.xml",
      title: "Example",
      status: "ok",
      itemCount: 1,
      cacheStatus: "miss",
    },
  ],
  items: [
    {
      id: "1",
      title: "Hello feed",
      link: "https://example.test/posts/1",
      summary: "A safe summary",
      publishedAt: "2026-07-30T10:00:00.000Z",
      feedId: "11111111-1111-4111-8111-111111111111",
      feedTitle: "Example",
      thumbnailUrl: "https://cdn.example.test/t.jpg",
    },
  ],
};

afterEach(() => {
  cleanup();
});

describe("RssRenderer", () => {
  it.each(REQUIRED_WIDGET_STATES)("renders state=%s", (state) => {
    render(
      <RssRenderer
        instanceId="1"
        title="RSS"
        config={{
          ...RSS_DEFAULT_CONFIG,
          feeds: [
            {
              id: "11111111-1111-4111-8111-111111111111",
              url: "https://example.test/feed.xml",
              titleOverride: "",
            },
          ],
        }}
        state={state}
        {...(state === "success" || state === "empty" || state === "stale" || state === "refreshing"
          ? { data: sampleData }
          : {})}
        message={`msg-${state}`}
      />,
    );
    expect(document.querySelector(`[data-widget="rss"][data-state="${state}"]`)).toBeTruthy();
  });

  it("renders detailed items as text without raw HTML", () => {
    render(
      <RssRenderer
        instanceId="1"
        title="RSS"
        config={RSS_DEFAULT_CONFIG}
        state="success"
        data={sampleData}
      />,
    );
    expect(screen.getByText("Hello feed")).toBeTruthy();
    expect(screen.getByText("A safe summary")).toBeTruthy();
    expect(document.querySelector("script")).toBeNull();
  });

  it("renders horizontal card layout", () => {
    render(
      <RssRenderer
        instanceId="1"
        title="RSS"
        config={{ ...RSS_DEFAULT_CONFIG, layout: "cards" }}
        state="success"
        data={{ ...sampleData, layout: "cards" }}
      />,
    );
    expect(screen.getByText("Hello feed")).toBeTruthy();
  });
});

describe("RssSettings", () => {
  it("renders feed controls", () => {
    render(<RssSettings instanceId="1" config={RSS_DEFAULT_CONFIG} onChange={() => undefined} />);
    expect(screen.getByLabelText("Add feed URL")).toBeTruthy();
    expect(screen.getByLabelText("Layout")).toBeTruthy();
  });
});
