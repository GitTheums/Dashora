import {
  FeedAdapterError,
  type LobstersAdapter,
  type LobstersFetchSourceResult,
  type LobstersSourceKind,
  type LobstersSourceRequest,
  type LobstersStoryPayload,
} from "@dashora/widget-sdk/widgets/lobsters/server";
import { type ProviderError, isProviderError } from "../errors.js";
import type { ProviderPlatform } from "../platform.js";

const LOBSTERS_BASE = "https://lobste.rs";
const PROVIDER_ID = "lobsters";

const FEED_PATH: Record<Exclude<LobstersSourceKind, "tag">, string> = {
  hottest: "/hottest.json",
  newest: "/newest.json",
  active: "/active.json",
};

type LobstersStoryJson = {
  short_id?: string;
  title?: string;
  url?: string;
  comments_url?: string;
  score?: number;
  comment_count?: number;
  submitter_user?: { username?: string };
  created_at?: string | number;
  tags?: string[];
};

function mapLobstersError(error: ProviderError): FeedAdapterError {
  const status = error.statusCode;
  if (error.code === "rate_limited" || status === 429) {
    return new FeedAdapterError("rate_limited", "Lobsters rate limit exceeded. Try again later.", {
      statusCode: status ?? 429,
      providerId: PROVIDER_ID,
      cause: error,
    });
  }
  if (status === 401 || status === 403) {
    return new FeedAdapterError(
      "forbidden",
      "Lobsters blocked this request. The JSON feed may have changed access rules.",
      { statusCode: status, providerId: PROVIDER_ID, cause: error },
    );
  }
  if (status === 404) {
    return new FeedAdapterError("not_found", "Lobsters source was not found.", {
      statusCode: status,
      providerId: PROVIDER_ID,
      cause: error,
    });
  }
  return new FeedAdapterError("upstream", "Could not load stories from Lobsters.", {
    ...(status !== undefined ? { statusCode: status } : {}),
    providerId: PROVIDER_ID,
    cause: error,
  });
}

function parseCreatedAt(value: string | number | undefined): string | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    const ms = value > 1_000_000_000_000 ? value : value * 1000;
    return new Date(ms).toISOString();
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) {
      return new Date(parsed).toISOString();
    }
  }
  return null;
}

function toStory(item: LobstersStoryJson): LobstersStoryPayload | null {
  if (!item.short_id || !item.title) {
    return null;
  }
  const id = String(item.short_id);
  const url = typeof item.url === "string" && item.url.trim() ? item.url.trim() : null;
  const commentsUrl =
    typeof item.comments_url === "string" && item.comments_url.trim()
      ? item.comments_url.trim()
      : `${LOBSTERS_BASE}/s/${id}`;
  const tags = Array.isArray(item.tags)
    ? item.tags.filter((tag): tag is string => typeof tag === "string" && tag.trim().length > 0)
    : [];
  return {
    id,
    title: item.title,
    url,
    commentsUrl,
    score: typeof item.score === "number" && Number.isFinite(item.score) ? item.score : 0,
    commentCount:
      typeof item.comment_count === "number" && Number.isFinite(item.comment_count)
        ? item.comment_count
        : 0,
    author:
      typeof item.submitter_user?.username === "string" && item.submitter_user.username.trim()
        ? item.submitter_user.username.trim()
        : "unknown",
    publishedAt: parseCreatedAt(item.created_at),
    tags,
  };
}

function feedUrl(baseUrl: string, request: LobstersSourceRequest): string {
  const root = baseUrl.replace(/\/$/, "");
  if (request.kind === "tag") {
    const tag = encodeURIComponent(request.tag?.trim() ?? "");
    return `${root}/t/${tag}.json`;
  }
  return `${root}${FEED_PATH[request.kind]}`;
}

export type LobstersAdapterOptions = {
  platform: ProviderPlatform;
  baseUrl?: string;
};

export function createLobstersAdapter(options: LobstersAdapterOptions): LobstersAdapter {
  const baseUrl = options.baseUrl ?? LOBSTERS_BASE;

  return {
    id: PROVIDER_ID,

    async fetchSource(request: LobstersSourceRequest): Promise<LobstersFetchSourceResult> {
      if (request.kind === "tag" && !request.tag?.trim()) {
        throw new FeedAdapterError("invalid_config", "Tag is required for tag sources.", {
          providerId: PROVIDER_ID,
        });
      }

      const url = feedUrl(baseUrl, request);

      try {
        const { data: listJson, result } = await options.platform.fetchJson({
          providerId: PROVIDER_ID,
          url,
          ...(request.signal ? { signal: request.signal } : {}),
          ...(request.forceRefresh !== undefined ? { forceRefresh: request.forceRefresh } : {}),
          cachePolicy: { ttlSeconds: 120, staleWhileRevalidateSeconds: 600 },
        });

        if (!Array.isArray(listJson)) {
          throw new FeedAdapterError(
            "upstream",
            "Lobsters returned an unexpected story list. The JSON feed may have changed.",
            { providerId: PROVIDER_ID },
          );
        }

        const limit = Math.max(1, request.limit);
        const stories: LobstersStoryPayload[] = [];
        for (const entry of listJson.slice(0, limit)) {
          const story = toStory(entry as LobstersStoryJson);
          if (story) {
            stories.push(story);
          }
        }

        return { stories, cacheStatus: result.cacheStatus };
      } catch (error) {
        if (error instanceof FeedAdapterError) {
          throw error;
        }
        if (isProviderError(error)) {
          throw mapLobstersError(error);
        }
        throw new FeedAdapterError("upstream", "Could not load stories from Lobsters.", {
          providerId: PROVIDER_ID,
          cause: error,
        });
      }
    },
  };
}
