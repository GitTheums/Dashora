import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { REQUIRED_WIDGET_STATES } from "../../states.js";
import { TWITCH_DEFAULT_CONFIG, type TwitchData } from "./config.js";
import { TwitchRenderer } from "./renderer.js";
import { TwitchSettings } from "./settings.js";

const sampleData: TwitchData = {
  layout: "rich",
  showThumbnails: true,
  showOfflineChannels: true,
  openInNewTab: true,
  fetchedAt: "2026-07-30T12:00:00.000Z",
  items: [
    {
      id: "100",
      login: "shroud",
      displayName: "Shroud",
      title: "Playing Valorant",
      gameName: "VALORANT",
      viewerCount: 12000,
      startedAt: "2026-07-30T10:00:00.000Z",
      url: "https://www.twitch.tv/shroud",
      thumbnailUrl: "https://static-cdn.jtvnw.net/previews-ttv/live_user_shroud-320x180.jpg",
      isLive: true,
      sourceId: "11111111-1111-4111-8111-111111111111",
    },
  ],
};

afterEach(() => {
  cleanup();
});

describe("TwitchRenderer", () => {
  it.each(REQUIRED_WIDGET_STATES)("renders state=%s", (state) => {
    render(
      <TwitchRenderer
        instanceId="1"
        title="Twitch"
        config={TWITCH_DEFAULT_CONFIG}
        state={state}
        {...(state === "success" || state === "empty" || state === "stale" || state === "refreshing"
          ? { data: sampleData }
          : {})}
        message={`msg-${state}`}
      />,
    );
    expect(document.querySelector(`[data-widget="twitch"][data-state="${state}"]`)).toBeTruthy();
  });

  it("renders live badge and safe outbound links", () => {
    render(
      <TwitchRenderer
        instanceId="1"
        title="Twitch"
        config={TWITCH_DEFAULT_CONFIG}
        state="success"
        data={sampleData}
      />,
    );
    expect(screen.getByText("Playing Valorant")).toBeTruthy();
    expect(screen.getByText("Live")).toBeTruthy();
    expect(screen.getByText(/12,000 viewers/)).toBeTruthy();
    const link = screen.getByText("Playing Valorant").closest("a");
    expect(link?.getAttribute("href")).toBe("https://www.twitch.tv/shroud");
    expect(link?.getAttribute("rel")).toContain("noopener");
  });
});

describe("TwitchSettings", () => {
  it("renders channel controls and credential hint", () => {
    render(
      <TwitchSettings instanceId="1" config={TWITCH_DEFAULT_CONFIG} onChange={() => undefined} />,
    );
    expect(screen.getByLabelText("Twitch settings")).toBeTruthy();
    expect(screen.getByText(/TWITCH_CLIENT_ID/)).toBeTruthy();
    expect(screen.getByText(/TWITCH_CLIENT_SECRET/)).toBeTruthy();
  });
});
