import { describe, expect, it, vi } from "vitest";
import { REQUIRED_WIDGET_STATES } from "../../states.js";
import type { TwitchAdapter, TwitchCredentials } from "./adapter.js";
import { FeedAdapterError } from "./adapter.js";
import { TWITCH_DEFAULT_CONFIG, type TwitchChannelConfig, twitchConfigSchema } from "./config.js";
import { twitchDefinition } from "./definition.js";
import { createTwitchProvider } from "./provider.js";

const credentials: TwitchCredentials = {
  clientId: "test-client-id",
  clientSecret: "test-client-secret",
};

const channelA: TwitchChannelConfig = {
  id: "11111111-1111-4111-8111-111111111111",
  login: "shroud",
  label: "Shroud",
};

const channelB: TwitchChannelConfig = {
  id: "22222222-2222-4222-8222-222222222222",
  login: "ninja",
};

function createAdapter(overrides: Partial<TwitchAdapter> = {}): TwitchAdapter {
  return {
    id: "fake-twitch",
    isConfigured: (creds) => Boolean(creds?.clientId.trim() && creds?.clientSecret.trim()),
    fetchChannels: vi.fn(async ({ logins }: { logins: string[] }) => ({
      channels: logins.map((login: string) => ({
        id: login === "shroud" ? "100" : "200",
        login,
        displayName: login === "shroud" ? "Shroud" : "Ninja",
        title: login === "shroud" ? "Playing Valorant" : null,
        gameName: login === "shroud" ? "VALORANT" : null,
        viewerCount: login === "shroud" ? 12000 : 0,
        startedAt: login === "shroud" ? "2026-07-30T10:00:00.000Z" : null,
        url: `https://www.twitch.tv/${login}`,
        thumbnailUrl:
          login === "shroud"
            ? "https://static-cdn.jtvnw.net/previews-ttv/live_user_shroud-320x180.jpg"
            : null,
        isLive: login === "shroud",
      })),
      cacheStatus: "miss" as const,
    })),
    ...overrides,
  };
}

describe("twitch definition", () => {
  it("covers every required runtime state", () => {
    expect(twitchDefinition.states).toEqual(REQUIRED_WIDGET_STATES);
    expect(twitchDefinition.id).toBe("twitch");
    expect(twitchDefinition.capabilities.requiresIntegration).toBe(true);
  });

  it("parses default config and lowercases logins", () => {
    const parsed = twitchConfigSchema.parse({
      channels: [{ id: channelA.id, login: "ShRoUd" }],
    });
    expect(parsed.channels[0]?.login).toBe("shroud");
  });
});

describe("twitch provider", () => {
  it("returns configuration-required without channels", async () => {
    const provider = createTwitchProvider({
      adapter: createAdapter(),
      resolveCredentials: () => credentials,
    });
    const result = await provider.fetch({
      instanceId: "tw1",
      config: TWITCH_DEFAULT_CONFIG,
    });
    expect(result.state).toBe("configuration-required");
  });

  it("returns configuration-required without credentials", async () => {
    const provider = createTwitchProvider({
      adapter: createAdapter(),
      resolveCredentials: () => null,
    });
    const result = await provider.fetch({
      instanceId: "tw2",
      config: { ...TWITCH_DEFAULT_CONFIG, channels: [channelA] },
    });
    expect(result.state).toBe("configuration-required");
    expect(result.message).toMatch(/TWITCH_CLIENT_ID/);
  });

  it("returns disabled when enabled is false", async () => {
    const provider = createTwitchProvider({
      adapter: createAdapter(),
      resolveCredentials: () => credentials,
    });
    const result = await provider.fetch({
      instanceId: "tw3",
      config: { ...TWITCH_DEFAULT_CONFIG, enabled: false, channels: [channelA] },
    });
    expect(result.state).toBe("disabled");
  });

  it("returns success with live and offline channels", async () => {
    const provider = createTwitchProvider({
      adapter: createAdapter(),
      resolveCredentials: () => credentials,
    });
    const result = await provider.fetch({
      instanceId: "tw4",
      config: { ...TWITCH_DEFAULT_CONFIG, channels: [channelA, channelB] },
    });
    expect(result.state).toBe("success");
    expect(result.data?.items).toHaveLength(2);
    expect(result.data?.items[0]?.isLive).toBe(true);
    expect(result.data?.items[1]?.isLive).toBe(false);
  });

  it("hides offline channels when showOfflineChannels is false", async () => {
    const provider = createTwitchProvider({
      adapter: createAdapter(),
      resolveCredentials: () => credentials,
    });
    const result = await provider.fetch({
      instanceId: "tw5",
      config: {
        ...TWITCH_DEFAULT_CONFIG,
        channels: [channelA, channelB],
        showOfflineChannels: false,
      },
    });
    expect(result.state).toBe("success");
    expect(result.data?.items).toHaveLength(1);
    expect(result.data?.items[0]?.login).toBe("shroud");
  });

  it("maps unauthorized adapter errors to configuration-required", async () => {
    const provider = createTwitchProvider({
      adapter: createAdapter({
        fetchChannels: vi.fn(async () => {
          throw new FeedAdapterError(
            "unauthorized",
            "Twitch rejected the client credentials. Update TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET.",
            { providerId: "twitch", statusCode: 401 },
          );
        }),
      }),
      resolveCredentials: () => credentials,
    });
    const result = await provider.fetch({
      instanceId: "tw6",
      config: { ...TWITCH_DEFAULT_CONFIG, channels: [channelA] },
    });
    expect(result.state).toBe("configuration-required");
  });
});
