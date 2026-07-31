import { describe, expect, it, vi } from "vitest";
import { REQUIRED_WIDGET_STATES } from "../../states.js";
import { FeedAdapterError, type LobstersAdapter } from "./adapter.js";
import {
  LOBSTERS_DEFAULT_CONFIG,
  type LobstersSourceConfig,
  type LobstersSourceKind,
  lobstersConfigSchema,
} from "./config.js";
import { newLobstersSourceId } from "./config.js";
import { lobstersDefinition } from "./definition.js";
import { createLobstersProvider } from "./provider.js";

const sourceHottest: LobstersSourceConfig = {
  id: "11111111-1111-4111-8111-111111111111",
  kind: "hottest",
  label: "Hot",
  itemLimit: 5,
};

const sourceNewest: LobstersSourceConfig = {
  id: "22222222-2222-4222-8222-222222222222",
  kind: "newest",
  itemLimit: 5,
};

function createAdapter(overrides: Partial<LobstersAdapter> = {}): LobstersAdapter {
  return {
    id: "fake-lobsters",
    fetchSource: vi.fn(async (request) => ({
      stories: [
        {
          id: request.kind === "newest" ? "n1" : "h1",
          title: `Story from ${request.kind}`,
          url: "https://example.test/post",
          commentsUrl: "https://lobste.rs/s/h1/fixture",
          score: 42,
          commentCount: 7,
          author: "alice",
          publishedAt: "2026-07-30T10:00:00.000Z",
          tags: ["rust", "programming"],
        },
      ],
      cacheStatus: "miss" as const,
    })),
    ...overrides,
  };
}

describe("lobsters definition", () => {
  it("covers every required runtime state", () => {
    expect(lobstersDefinition.states).toEqual(REQUIRED_WIDGET_STATES);
    expect(lobstersDefinition.id).toBe("lobsters");
  });

  it("parses default config", () => {
    expect(lobstersConfigSchema.parse({})).toEqual(LOBSTERS_DEFAULT_CONFIG);
  });
});

describe("lobsters provider", () => {
  it("returns configuration-required without sources", async () => {
    const provider = createLobstersProvider({ adapter: createAdapter() });
    const result = await provider.fetch({
      instanceId: "l1",
      config: LOBSTERS_DEFAULT_CONFIG,
    });
    expect(result.state).toBe("configuration-required");
  });

  it("returns disabled when enabled is false", async () => {
    const provider = createLobstersProvider({ adapter: createAdapter() });
    const result = await provider.fetch({
      instanceId: "l2",
      config: { ...LOBSTERS_DEFAULT_CONFIG, enabled: false, sources: [sourceHottest] },
    });
    expect(result.state).toBe("disabled");
  });

  it("returns success with sanitized titles and safe links", async () => {
    const provider = createLobstersProvider({
      adapter: createAdapter({
        fetchSource: vi.fn(async () => ({
          stories: [
            {
              id: "x1",
              title: "Hello <b>Lobsters</b>",
              url: "https://example.test/post",
              commentsUrl: "https://lobste.rs/s/x1/hello",
              score: 10,
              commentCount: 2,
              author: "bob",
              publishedAt: "2026-07-30T10:00:00.000Z",
              tags: ["go"],
            },
          ],
          cacheStatus: "miss" as const,
        })),
      }),
    });
    const result = await provider.fetch({
      instanceId: "l3",
      config: { ...LOBSTERS_DEFAULT_CONFIG, sources: [sourceHottest] },
    });
    expect(result.state).toBe("success");
    expect(result.data?.items[0]?.title).toBe("Hello Lobsters");
    expect(result.data?.items[0]?.url).toBe("https://example.test/post");
    expect(result.data?.items[0]?.commentsUrl).toBe("https://lobste.rs/s/x1/hello");
  });

  it("aggregates multiple sources and sorts by publishedAt", async () => {
    const provider = createLobstersProvider({
      adapter: createAdapter({
        fetchSource: vi.fn(async (request) => ({
          stories: [
            {
              id: `${request.kind}-1`,
              title: `${request.kind} story`,
              url: `https://example.test/${request.kind}`,
              commentsUrl: `https://lobste.rs/s/${request.kind}-1/title`,
              score: 1,
              commentCount: 0,
              author: "alice",
              publishedAt:
                request.kind === "hottest"
                  ? "2026-07-30T09:00:00.000Z"
                  : "2026-07-30T11:00:00.000Z",
              tags: [],
            },
          ],
          cacheStatus: "hit" as const,
        })),
      }),
    });
    const result = await provider.fetch({
      instanceId: "l4",
      config: { ...LOBSTERS_DEFAULT_CONFIG, sources: [sourceHottest, sourceNewest] },
    });
    expect(result.state).toBe("success");
    expect(result.data?.items).toHaveLength(2);
    expect(result.data?.items[0]?.title).toBe("newest story");
    expect(result.data?.sources).toHaveLength(2);
    expect(result.data?.sources[0]?.label).toBe("Hot");
  });

  it("returns empty when all sources yield no stories", async () => {
    const provider = createLobstersProvider({
      adapter: createAdapter({
        fetchSource: vi.fn(async () => ({ stories: [], cacheStatus: "hit" as const })),
      }),
    });
    const result = await provider.fetch({
      instanceId: "l5",
      config: { ...LOBSTERS_DEFAULT_CONFIG, sources: [sourceHottest] },
    });
    expect(result.state).toBe("empty");
  });

  it("isolates source failures and returns stale with remaining items", async () => {
    const provider = createLobstersProvider({
      adapter: createAdapter({
        fetchSource: vi.fn(async (request) => {
          if (request.kind === "newest") {
            throw new FeedAdapterError("upstream", "down", { providerId: "lobsters" });
          }
          return {
            stories: [
              {
                id: "survive",
                title: "Surviving story",
                url: "https://example.test/ok",
                commentsUrl: "https://lobste.rs/s/survive/title",
                score: 3,
                commentCount: 1,
                author: "carol",
                publishedAt: "2026-07-30T10:00:00.000Z",
                tags: [],
              },
            ],
            cacheStatus: "hit" as const,
          };
        }),
      }),
    });
    const result = await provider.fetch({
      instanceId: "l6",
      config: { ...LOBSTERS_DEFAULT_CONFIG, sources: [sourceHottest, sourceNewest] },
    });
    expect(result.state).toBe("stale");
    expect(result.data?.items).toHaveLength(1);
    expect(result.data?.failedSourceCount).toBe(1);
    expect(result.data?.sources.find((source) => source.id === sourceNewest.id)?.status).toBe(
      "error",
    );
  });

  it("returns error when every source fails", async () => {
    const provider = createLobstersProvider({
      adapter: createAdapter({
        fetchSource: vi.fn(async () => {
          throw new Error("down");
        }),
      }),
    });
    const result = await provider.fetch({
      instanceId: "l7",
      config: { ...LOBSTERS_DEFAULT_CONFIG, sources: [sourceHottest] },
    });
    expect(result.state).toBe("error");
    expect(result.errorCode).toBe("lobsters_all_sources_failed");
  });

  it("returns stale when adapter cache is stale", async () => {
    const provider = createLobstersProvider({
      adapter: createAdapter({
        fetchSource: vi.fn(async () => ({
          stories: [
            {
              id: "stale1",
              title: "Cached",
              url: null,
              commentsUrl: "https://lobste.rs/s/stale1/title",
              score: 1,
              commentCount: 0,
              author: "dave",
              publishedAt: "2026-07-30T09:00:00.000Z",
              tags: [],
            },
          ],
          cacheStatus: "stale" as const,
        })),
      }),
    });
    const result = await provider.fetch({
      instanceId: "l8",
      config: { ...LOBSTERS_DEFAULT_CONFIG, sources: [sourceHottest] },
    });
    expect(result.state).toBe("stale");
  });

  it("fetches tag sources with the tag parameter", async () => {
    const fetchSource = vi.fn(async () => ({
      stories: [
        {
          id: "t1",
          title: "Tagged",
          url: "https://example.test/tagged",
          commentsUrl: "https://lobste.rs/s/t1/tagged",
          score: 5,
          commentCount: 0,
          author: "eve",
          publishedAt: "2026-07-30T10:00:00.000Z",
          tags: ["rust"],
        },
      ],
      cacheStatus: "miss" as const,
    }));
    const provider = createLobstersProvider({ adapter: createAdapter({ fetchSource }) });
    const tagSource: LobstersSourceConfig = {
      id: "33333333-3333-4333-8333-333333333333",
      kind: "tag",
      tag: "rust",
    };
    const result = await provider.fetch({
      instanceId: "l9",
      config: { ...LOBSTERS_DEFAULT_CONFIG, sources: [tagSource] },
    });
    expect(result.state).toBe("success");
    expect(fetchSource).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "tag" as LobstersSourceKind, tag: "rust" }),
    );
  });

  it("uses a generated source id helper", () => {
    expect(newLobstersSourceId()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });
});
