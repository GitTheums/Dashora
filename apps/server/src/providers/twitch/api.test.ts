import { afterEach, describe, expect, it } from "vitest";
import { createTestServerEnv } from "../../test/env.js";
import { createProviderPlatform } from "../platform.js";
import { startMockUpstream } from "../test/mock-upstream.js";
import { createTwitchAdapter } from "./api.js";

const credentials = {
  clientId: "test-client-id",
  clientSecret: "test-client-secret",
};

const fixtures = {
  token: {
    access_token: "fixture-access-token",
    expires_in: 3600,
    token_type: "bearer",
  },
  users: {
    data: [
      {
        id: "100",
        login: "shroud",
        display_name: "Shroud",
      },
      {
        id: "200",
        login: "ninja",
        display_name: "Ninja",
      },
    ],
  },
  streams: {
    data: [
      {
        id: "9001",
        user_id: "100",
        user_login: "shroud",
        user_name: "Shroud",
        game_name: "VALORANT",
        title: "Ranked grind",
        viewer_count: 15000,
        started_at: "2026-07-30T10:00:00.000Z",
        thumbnail_url:
          "https://static-cdn.jtvnw.net/previews-ttv/live_user_shroud-{width}x{height}.jpg",
        type: "live",
      },
    ],
  },
};

describe("twitch adapter", () => {
  let closeUpstream: (() => Promise<void>) | undefined;

  afterEach(async () => {
    if (closeUpstream) {
      await closeUpstream();
      closeUpstream = undefined;
    }
  });

  it("loads token, users, and streams fixtures and merges live/offline channels", async () => {
    const upstream = await startMockUpstream((req, res) => {
      const url = req.url ?? "";
      res.setHeader("content-type", "application/json");
      if (url.includes("/oauth2/token")) {
        res.end(JSON.stringify(fixtures.token));
        return;
      }
      if (url.includes("/helix/users")) {
        res.end(JSON.stringify(fixtures.users));
        return;
      }
      if (url.includes("/helix/streams")) {
        res.end(JSON.stringify(fixtures.streams));
        return;
      }
      res.statusCode = 404;
      res.end("{}");
    });
    closeUpstream = upstream.close;

    const platform = createProviderPlatform({ env: createTestServerEnv() });
    const adapter = createTwitchAdapter({
      platform,
      apiBaseUrl: `${upstream.baseUrl}/helix`,
      tokenUrl: `${upstream.baseUrl}/oauth2/token`,
    });

    const result = await adapter.fetchChannels({
      logins: ["shroud", "ninja"],
      credentials,
    });

    expect(result.channels).toHaveLength(2);
    const live = result.channels.find((channel) => channel.login === "shroud");
    const offline = result.channels.find((channel) => channel.login === "ninja");
    expect(live?.isLive).toBe(true);
    expect(live?.title).toBe("Ranked grind");
    expect(live?.viewerCount).toBe(15000);
    expect(live?.thumbnailUrl).toContain("320x180");
    expect(offline?.isLive).toBe(false);
    expect(offline?.viewerCount).toBe(0);
  });

  it("maps 401 token responses to unauthorized", async () => {
    const upstream = await startMockUpstream((_req, res) => {
      res.statusCode = 401;
      res.end(JSON.stringify({ message: "invalid client" }));
    });
    closeUpstream = upstream.close;

    const platform = createProviderPlatform({ env: createTestServerEnv() });
    const adapter = createTwitchAdapter({
      platform,
      apiBaseUrl: `${upstream.baseUrl}/helix`,
      tokenUrl: `${upstream.baseUrl}/oauth2/token`,
    });

    await expect(adapter.fetchChannels({ logins: ["shroud"], credentials })).rejects.toMatchObject({
      code: "unauthorized",
      providerId: "twitch",
    });
  });

  it("reports not_configured when credentials are missing", async () => {
    const platform = createProviderPlatform({ env: createTestServerEnv() });
    const adapter = createTwitchAdapter({ platform });

    await expect(
      adapter.fetchChannels({
        logins: ["shroud"],
        credentials: { clientId: "", clientSecret: "" },
      }),
    ).rejects.toMatchObject({
      code: "not_configured",
      providerId: "twitch",
    });
  });
});
