import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { REQUIRED_WIDGET_STATES } from "../../states.js";
import { HACKER_NEWS_DEFAULT_CONFIG, type HackerNewsData } from "./config.js";
import { HackerNewsRenderer } from "./renderer.js";
import { HackerNewsSettings } from "./settings.js";

const sampleData: HackerNewsData = {
  feed: "top",
  layout: "rich",
  showScore: true,
  showCommentCount: true,
  openInNewTab: true,
  fetchedAt: "2026-07-30T12:00:00.000Z",
  items: [
    {
      id: "1",
      title: "Hello HN",
      url: "https://example.test/post",
      hnUrl: "https://news.ycombinator.com/item?id=1",
      score: 42,
      commentCount: 7,
      author: "alice",
      publishedAt: "2026-07-30T10:00:00.000Z",
      domain: "example.test",
    },
  ],
};

afterEach(() => {
  cleanup();
});

describe("HackerNewsRenderer", () => {
  it.each(REQUIRED_WIDGET_STATES)("renders state=%s", (state) => {
    render(
      <HackerNewsRenderer
        instanceId="1"
        title="Hacker News"
        config={HACKER_NEWS_DEFAULT_CONFIG}
        state={state}
        {...(state === "success" || state === "empty" || state === "stale" || state === "refreshing"
          ? { data: sampleData }
          : {})}
        message={`msg-${state}`}
      />,
    );
    expect(
      document.querySelector(`[data-widget="hacker-news"][data-state="${state}"]`),
    ).toBeTruthy();
  });

  it("renders story titles with safe outbound links", () => {
    render(
      <HackerNewsRenderer
        instanceId="1"
        title="Hacker News"
        config={HACKER_NEWS_DEFAULT_CONFIG}
        state="success"
        data={sampleData}
      />,
    );
    expect(screen.getByText("Hello HN")).toBeTruthy();
    const link = screen.getByText("Hello HN").closest("a");
    expect(link?.getAttribute("href")).toBe("https://example.test/post");
    expect(link?.getAttribute("rel")).toContain("noopener");
  });
});

describe("HackerNewsSettings", () => {
  it("renders feed controls", () => {
    render(
      <HackerNewsSettings
        instanceId="1"
        config={HACKER_NEWS_DEFAULT_CONFIG}
        onChange={() => undefined}
      />,
    );
    expect(screen.getByLabelText("Hacker News settings")).toBeTruthy();
    expect(screen.getByLabelText("Feed")).toBeTruthy();
  });
});
