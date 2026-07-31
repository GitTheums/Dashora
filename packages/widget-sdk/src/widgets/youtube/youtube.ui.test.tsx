import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { REQUIRED_WIDGET_STATES } from "../../states.js";
import { YOUTUBE_DEFAULT_CONFIG, type YoutubeData } from "./config.js";
import { YoutubeRenderer } from "./renderer.js";
import { YoutubeSettings } from "./settings.js";

const sampleData: YoutubeData = {
  layout: "rich",
  showThumbnails: true,
  openInNewTab: true,
  fetchedAt: "2026-07-30T12:00:00.000Z",
  failedSourceCount: 0,
  sources: [
    {
      id: "11111111-1111-4111-8111-111111111111",
      channelId: "UCxxxxxxxxxxxxxxxxxxxxxx",
      label: "Demo",
      status: "ok",
      itemCount: 1,
    },
  ],
  items: [
    {
      id: "1",
      title: "Hello YouTube",
      url: "https://www.youtube.com/watch?v=abc123",
      channelTitle: "Demo Channel",
      publishedAt: "2026-07-30T10:00:00.000Z",
      thumbnailUrl: "https://i.ytimg.com/vi/abc123/hqdefault.jpg",
      sourceId: "11111111-1111-4111-8111-111111111111",
      sourceLabel: "Demo",
    },
  ],
};

afterEach(() => {
  cleanup();
});

describe("YoutubeRenderer", () => {
  it.each(REQUIRED_WIDGET_STATES)("renders state=%s", (state) => {
    render(
      <YoutubeRenderer
        instanceId="1"
        title="YouTube"
        config={YOUTUBE_DEFAULT_CONFIG}
        state={state}
        {...(state === "success" || state === "empty" || state === "stale" || state === "refreshing"
          ? { data: sampleData }
          : {})}
        message={`msg-${state}`}
      />,
    );
    expect(document.querySelector(`[data-widget="youtube"][data-state="${state}"]`)).toBeTruthy();
  });

  it("renders video titles with safe outbound links", () => {
    render(
      <YoutubeRenderer
        instanceId="1"
        title="YouTube"
        config={YOUTUBE_DEFAULT_CONFIG}
        state="success"
        data={sampleData}
      />,
    );
    expect(screen.getByText("Hello YouTube")).toBeTruthy();
    const link = screen.getByText("Hello YouTube").closest("a");
    expect(link?.getAttribute("href")).toBe("https://www.youtube.com/watch?v=abc123");
    expect(link?.getAttribute("rel")).toContain("noopener");
  });
});

describe("YoutubeSettings", () => {
  it("renders channel controls", () => {
    render(
      <YoutubeSettings instanceId="1" config={YOUTUBE_DEFAULT_CONFIG} onChange={() => undefined} />,
    );
    expect(screen.getByLabelText("YouTube settings")).toBeTruthy();
    expect(screen.getByLabelText("Add channel ID")).toBeTruthy();
  });
});
