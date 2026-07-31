import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { REQUIRED_WIDGET_STATES } from "../../states.js";
import { LOBSTERS_DEFAULT_CONFIG, type LobstersData } from "./config.js";
import { LobstersRenderer } from "./renderer.js";
import { LobstersSettings } from "./settings.js";

const sampleData: LobstersData = {
  layout: "rich",
  showScore: true,
  showCommentCount: true,
  openInNewTab: true,
  fetchedAt: "2026-07-30T12:00:00.000Z",
  failedSourceCount: 0,
  sources: [
    {
      id: "11111111-1111-4111-8111-111111111111",
      kind: "hottest",
      label: "Hottest",
      status: "ok",
      itemCount: 1,
    },
  ],
  items: [
    {
      id: "abc123",
      title: "Hello Lobsters",
      url: "https://example.test/post",
      commentsUrl: "https://lobste.rs/s/abc123/hello",
      score: 42,
      commentCount: 7,
      author: "alice",
      publishedAt: "2026-07-30T10:00:00.000Z",
      tags: ["rust"],
      sourceId: "11111111-1111-4111-8111-111111111111",
      sourceLabel: "Hottest",
    },
  ],
};

afterEach(() => {
  cleanup();
});

describe("LobstersRenderer", () => {
  it.each(REQUIRED_WIDGET_STATES)("renders state=%s", (state) => {
    render(
      <LobstersRenderer
        instanceId="1"
        title="Lobsters"
        config={LOBSTERS_DEFAULT_CONFIG}
        state={state}
        {...(state === "success" || state === "empty" || state === "stale" || state === "refreshing"
          ? { data: sampleData }
          : {})}
        message={`msg-${state}`}
      />,
    );
    expect(document.querySelector(`[data-widget="lobsters"][data-state="${state}"]`)).toBeTruthy();
  });

  it("renders story titles with safe outbound links", () => {
    render(
      <LobstersRenderer
        instanceId="1"
        title="Lobsters"
        config={LOBSTERS_DEFAULT_CONFIG}
        state="success"
        data={sampleData}
      />,
    );
    expect(screen.getByText("Hello Lobsters")).toBeTruthy();
    const link = screen.getByText("Hello Lobsters").closest("a");
    expect(link?.getAttribute("href")).toBe("https://example.test/post");
    expect(link?.getAttribute("rel")).toContain("noopener");
  });
});

describe("LobstersSettings", () => {
  it("renders source controls", () => {
    render(
      <LobstersSettings
        instanceId="1"
        config={LOBSTERS_DEFAULT_CONFIG}
        onChange={() => undefined}
      />,
    );
    expect(screen.getByLabelText("Lobsters settings")).toBeTruthy();
    expect(screen.getByLabelText("Add source")).toBeTruthy();
  });
});
