import { describe, expect, it, vi } from "vitest";
import { REQUIRED_WIDGET_STATES } from "../../states.js";
import type { YoutubeAdapter } from "./adapter.js";
import {
  YOUTUBE_DEFAULT_CONFIG,
  type YoutubeChannelConfig,
  youtubeConfigSchema,
} from "./config.js";
import { youtubeDefinition } from "./definition.js";
import { createYoutubeProvider } from "./provider.js";

const channelA: YoutubeChannelConfig = {
  id: "11111111-1111-4111-8111-111111111111",
  channelId: "UCxxxxxxxxxxxxxxxxxxxxxx",
  label: "Alpha",
  itemLimit: 5,
};

const channelB: YoutubeChannelConfig = {
  id: "22222222-2222-4222-8222-222222222222",
  channelId: "UCyyyyyyyyyyyyyyyyyyyyyy",
  label: "",
  itemLimit: 5,
};

function createAdapter(overrides: Partial<YoutubeAdapter> = {}): YoutubeAdapter {
  return {
    id: "fake-youtube",
    fetchChannel: vi.fn(async ({ channelId }) => ({
      channelTitle: channelId.includes("yyyy") ? "Bravo Channel" : "Alpha Channel",
      videos: [
        {
          id: `vid-${channelId}`,
          title: `Video from ${channelId}`,
          url: "https://www.youtube.com/watch?v=abc123",
          channelTitle: channelId.includes("yyyy") ? "Bravo Channel" : "Alpha Channel",
          publishedAt: "2026-07-30T10:00:00.000Z",
          thumbnailUrl: "https://i.ytimg.com/vi/abc123/hqdefault.jpg",
        },
        {
          id: `vid2-${channelId}`,
          title: "Another upload",
          url: "https://www.youtube.com/watch?v=def456",
          channelTitle: channelId.includes("yyyy") ? "Bravo Channel" : "Alpha Channel",
          publishedAt: "2026-07-30T09:00:00.000Z",
          thumbnailUrl: null,
        },
      ],
      cacheStatus: "miss" as const,
    })),
    ...overrides,
  };
}

describe("youtube definition", () => {
  it("covers every required runtime state", () => {
    expect(youtubeDefinition.states).toEqual(REQUIRED_WIDGET_STATES);
    expect(youtubeDefinition.id).toBe("youtube");
  });

  it("parses default config", () => {
    expect(youtubeConfigSchema.parse({})).toEqual(YOUTUBE_DEFAULT_CONFIG);
  });
});

describe("youtube provider", () => {
  it("returns configuration-required without channels", async () => {
    const provider = createYoutubeProvider({ adapter: createAdapter() });
    const result = await provider.fetch({
      instanceId: "yt1",
      config: YOUTUBE_DEFAULT_CONFIG,
    });
    expect(result.state).toBe("configuration-required");
  });

  it("returns disabled when enabled is false", async () => {
    const provider = createYoutubeProvider({ adapter: createAdapter() });
    const result = await provider.fetch({
      instanceId: "yt2",
      config: { ...YOUTUBE_DEFAULT_CONFIG, enabled: false, channels: [channelA] },
    });
    expect(result.state).toBe("disabled");
  });

  it("aggregates channels and isolates per-channel failures", async () => {
    const provider = createYoutubeProvider({
      adapter: createAdapter({
        fetchChannel: vi.fn(async ({ channelId }) => {
          if (channelId.includes("yyyy")) {
            throw new Error("upstream failed");
          }
          return {
            channelTitle: "Alpha Channel",
            videos: [
              {
                id: "v1",
                title: "Alpha video",
                url: "https://www.youtube.com/watch?v=alpha",
                channelTitle: "Alpha Channel",
                publishedAt: "2026-07-30T10:00:00.000Z",
                thumbnailUrl: "https://i.ytimg.com/vi/alpha/hqdefault.jpg",
              },
            ],
            cacheStatus: "miss" as const,
          };
        }),
      }),
    });
    const result = await provider.fetch({
      instanceId: "yt3",
      config: {
        ...YOUTUBE_DEFAULT_CONFIG,
        channels: [channelA, channelB],
      },
    });
    expect(result.state).toBe("stale");
    expect(result.data?.items).toHaveLength(1);
    expect(result.data?.failedSourceCount).toBe(1);
    expect(result.data?.sources[1]?.status).toBe("error");
  });

  it("returns error when all channels fail", async () => {
    const provider = createYoutubeProvider({
      adapter: createAdapter({
        fetchChannel: vi.fn(async () => {
          throw new Error("fail");
        }),
      }),
    });
    const result = await provider.fetch({
      instanceId: "yt4",
      config: { ...YOUTUBE_DEFAULT_CONFIG, channels: [channelA] },
    });
    expect(result.state).toBe("error");
    expect(result.errorCode).toBe("youtube_all_channels_failed");
  });

  it("returns success with sanitized items", async () => {
    const provider = createYoutubeProvider({ adapter: createAdapter() });
    const result = await provider.fetch({
      instanceId: "yt5",
      config: { ...YOUTUBE_DEFAULT_CONFIG, channels: [channelA] },
    });
    expect(result.state).toBe("success");
    expect(result.data?.items[0]?.title).toBeTruthy();
    expect(result.data?.items[0]?.url).toMatch(/^https:\/\//);
  });
});
