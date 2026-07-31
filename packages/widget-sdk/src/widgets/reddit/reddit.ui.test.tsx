import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { REQUIRED_WIDGET_STATES } from "../../states.js";
import { REDDIT_DEFAULT_CONFIG, type RedditData } from "./config.js";
import { RedditRenderer } from "./renderer.js";
import { RedditSettings } from "./settings.js";

const SAMPLE_SUBREDDIT_ID = "11111111-1111-4111-8111-111111111111";

const sampleConfigSubreddit = {
  id: SAMPLE_SUBREDDIT_ID,
  name: "programming",
  sort: "hot" as const,
  label: "",
};

const sampleData: RedditData = {
  layout: "rich",
  showThumbnails: true,
  showScore: true,
  showCommentCount: true,
  openInNewTab: true,
  fetchedAt: "2026-07-30T12:00:00.000Z",
  failedSourceCount: 0,
  sources: [
    {
      id: "11111111-1111-4111-8111-111111111111",
      name: "programming",
      label: "Programming",
      status: "ok",
      itemCount: 1,
    },
  ],
  items: [
    {
      id: "p1",
      title: "Hello Reddit",
      url: "https://example.test/post",
      permalinkUrl: "https://www.reddit.com/r/programming/comments/p1/hello/",
      score: 42,
      commentCount: 7,
      author: "alice",
      subreddit: "programming",
      publishedAt: "2026-07-30T10:00:00.000Z",
      thumbnailUrl: "https://cdn.example.test/thumb.jpg",
      sourceId: "11111111-1111-4111-8111-111111111111",
      sourceLabel: "Programming",
    },
  ],
};

afterEach(() => {
  cleanup();
});

describe("RedditRenderer", () => {
  it.each(REQUIRED_WIDGET_STATES)("renders state=%s", (state) => {
    render(
      <RedditRenderer
        instanceId="1"
        title="Reddit"
        config={{
          ...REDDIT_DEFAULT_CONFIG,
          subreddits: sampleData.sources.map((s) => ({
            id: s.id,
            name: s.name,
            sort: "hot" as const,
            label: s.label,
          })),
        }}
        state={state}
        {...(state === "success" || state === "empty" || state === "stale" || state === "refreshing"
          ? { data: sampleData }
          : {})}
        message={`msg-${state}`}
      />,
    );
    expect(document.querySelector(`[data-widget="reddit"][data-state="${state}"]`)).toBeTruthy();
  });

  it("renders post titles with safe outbound links", () => {
    render(
      <RedditRenderer
        instanceId="1"
        title="Reddit"
        config={{
          ...REDDIT_DEFAULT_CONFIG,
          subreddits: [sampleConfigSubreddit],
        }}
        state="success"
        data={sampleData}
      />,
    );
    expect(screen.getByText("Hello Reddit")).toBeTruthy();
    const link = screen.getByText("Hello Reddit").closest("a");
    expect(link?.getAttribute("href")).toBe("https://example.test/post");
    expect(link?.getAttribute("rel")).toContain("noopener");
  });

  it("renders thumbnails in rich layout when enabled", () => {
    render(
      <RedditRenderer
        instanceId="1"
        title="Reddit"
        config={{
          ...REDDIT_DEFAULT_CONFIG,
          layout: "rich",
          showThumbnails: true,
          subreddits: [sampleConfigSubreddit],
        }}
        state="success"
        data={sampleData}
      />,
    );
    const img = document.querySelector('img[src="https://cdn.example.test/thumb.jpg"]');
    expect(img).toBeTruthy();
  });
});

describe("RedditSettings", () => {
  it("renders subreddit controls and mentions server env vars", () => {
    render(
      <RedditSettings
        instanceId="1"
        config={{
          ...REDDIT_DEFAULT_CONFIG,
          subreddits: [sampleConfigSubreddit],
        }}
        onChange={() => undefined}
      />,
    );
    expect(screen.getByLabelText("Reddit settings")).toBeTruthy();
    expect(screen.getByText(/REDDIT_CLIENT_ID/)).toBeTruthy();
    expect(screen.getByText(/REDDIT_CLIENT_SECRET/)).toBeTruthy();
  });
});
