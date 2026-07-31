import {
  FeedAdapterError,
  type RedditAdapter,
  type RedditCredentials,
  type RedditPostPayload,
  type RedditSort,
  type RedditSubredditFetchRequest,
  type RedditSubredditFetchResult,
  type RedditTimeFrame,
} from "@dashora/widget-sdk/widgets/reddit/server";
import { type ProviderError, isProviderError } from "../errors.js";
import type { ProviderPlatform } from "../platform.js";

const REDDIT_OAUTH_BASE = "https://oauth.reddit.com";
const REDDIT_TOKEN_URL = "https://www.reddit.com/api/v1/access_token";
const REDDIT_SITE_BASE = "https://www.reddit.com";
const PROVIDER_ID = "reddit";

const SKIP_THUMBNAILS = new Set(["self", "default", "nsfw", "spoiler", "image", ""]);

type RedditTokenResponse = {
  access_token?: string;
  token_type?: string;
  expires_in?: number;
  scope?: string;
};

type RedditListingChild = {
  data?: RedditPostJson;
};

type RedditPostJson = {
  id?: string;
  title?: string;
  url?: string;
  permalink?: string;
  score?: number;
  num_comments?: number;
  author?: string;
  subreddit?: string;
  created_utc?: number;
  thumbnail?: string;
  preview?: {
    images?: Array<{
      source?: { url?: string };
    }>;
  };
};

type RedditListingResponse = {
  data?: {
    children?: RedditListingChild[];
  };
};

type CachedToken = {
  clientId: string;
  token: string;
  expiresAt: number;
};

let cachedToken: CachedToken | null = null;

function isConfigured(credentials: RedditCredentials | null): boolean {
  if (!credentials) {
    return false;
  }
  return credentials.clientId.trim().length > 0 && credentials.clientSecret.trim().length > 0;
}

function basicAuthHeader(credentials: RedditCredentials): string {
  const encoded = Buffer.from(
    `${credentials.clientId.trim()}:${credentials.clientSecret.trim()}`,
  ).toString("base64");
  return `Basic ${encoded}`;
}

function mapRedditError(error: ProviderError, context: "token" | "listing"): FeedAdapterError {
  const status = error.statusCode;
  if (error.code === "rate_limited" || status === 429) {
    return new FeedAdapterError(
      "rate_limited",
      "Reddit API rate limit exceeded. Try again later.",
      { statusCode: status ?? 429, providerId: PROVIDER_ID, cause: error },
    );
  }
  if (status === 401) {
    return new FeedAdapterError(
      "unauthorized",
      context === "token"
        ? "Reddit rejected the API credentials. Set REDDIT_CLIENT_ID and REDDIT_CLIENT_SECRET on the server."
        : "Reddit rejected this request. Check API credentials on the server.",
      { statusCode: 401, providerId: PROVIDER_ID, cause: error },
    );
  }
  if (status === 403) {
    return new FeedAdapterError(
      "forbidden",
      "Reddit blocked this request. The OAuth API may have changed access rules.",
      { statusCode: 403, providerId: PROVIDER_ID, cause: error },
    );
  }
  if (status === 404) {
    return new FeedAdapterError("not_found", "Subreddit not found or is unavailable.", {
      statusCode: 404,
      providerId: PROVIDER_ID,
      cause: error,
    });
  }
  return new FeedAdapterError("upstream", "Could not load posts from Reddit.", {
    ...(status !== undefined ? { statusCode: status } : {}),
    providerId: PROVIDER_ID,
    cause: error,
  });
}

function wrapError(error: unknown, context: "token" | "listing"): never {
  if (error instanceof FeedAdapterError) {
    throw error;
  }
  if (isProviderError(error)) {
    throw mapRedditError(error, context);
  }
  throw new FeedAdapterError("upstream", "Could not load posts from Reddit.", {
    providerId: PROVIDER_ID,
    cause: error,
  });
}

function decodePreviewUrl(value: string): string {
  return value.replace(/&amp;/g, "&");
}

function extractThumbnail(data: RedditPostJson): string | null {
  const thumb = typeof data.thumbnail === "string" ? data.thumbnail.trim() : "";
  if (thumb && !SKIP_THUMBNAILS.has(thumb.toLowerCase()) && /^https?:\/\//i.test(thumb)) {
    return thumb;
  }
  const previewUrl = data.preview?.images?.[0]?.source?.url;
  if (typeof previewUrl === "string" && previewUrl.trim()) {
    const decoded = decodePreviewUrl(previewUrl.trim());
    if (/^https?:\/\//i.test(decoded)) {
      return decoded;
    }
  }
  return null;
}

function toPermalinkUrl(permalink: string | undefined): string | null {
  if (!permalink || !permalink.startsWith("/")) {
    return null;
  }
  return `${REDDIT_SITE_BASE}${permalink}`;
}

function toPost(data: RedditPostJson): RedditPostPayload | null {
  if (!data.id || !data.title) {
    return null;
  }
  const permalinkUrl = toPermalinkUrl(data.permalink);
  if (!permalinkUrl) {
    return null;
  }
  const url =
    typeof data.url === "string" && data.url.trim().startsWith("http") ? data.url.trim() : null;
  return {
    id: data.id,
    title: data.title,
    url,
    permalinkUrl,
    score: typeof data.score === "number" && Number.isFinite(data.score) ? data.score : 0,
    commentCount:
      typeof data.num_comments === "number" && Number.isFinite(data.num_comments)
        ? Math.max(0, Math.trunc(data.num_comments))
        : 0,
    author: typeof data.author === "string" && data.author.trim() ? data.author.trim() : "unknown",
    subreddit:
      typeof data.subreddit === "string" && data.subreddit.trim()
        ? data.subreddit.trim()
        : "unknown",
    publishedAt:
      typeof data.created_utc === "number" && Number.isFinite(data.created_utc)
        ? new Date(data.created_utc * 1000).toISOString()
        : null,
    thumbnailUrl: extractThumbnail(data),
  };
}

function buildListingUrl(
  baseUrl: string,
  name: string,
  sort: RedditSort,
  limit: number,
  timeFrame?: RedditTimeFrame,
): string {
  const encoded = encodeURIComponent(name);
  const params = new URLSearchParams({
    limit: String(Math.min(100, Math.max(1, limit))),
    raw_json: "1",
  });
  if (sort === "top" && timeFrame) {
    params.set("t", timeFrame);
  }
  return `${baseUrl}/r/${encoded}/${sort}.json?${params.toString()}`;
}

async function fetchAccessToken(
  platform: ProviderPlatform,
  credentials: RedditCredentials,
  tokenUrl: string,
  signal?: AbortSignal,
  forceRefresh?: boolean,
): Promise<string> {
  const clientId = credentials.clientId.trim();
  const now = Date.now();
  if (
    !forceRefresh &&
    cachedToken &&
    cachedToken.clientId === clientId &&
    cachedToken.expiresAt > now + 30_000
  ) {
    return cachedToken.token;
  }

  try {
    // Never SWR-cache token POSTs — the Authorization header carries the client secret.
    const { data } = await platform.fetchJson<RedditTokenResponse>({
      providerId: `${PROVIDER_ID}:token`,
      url: tokenUrl,
      method: "POST",
      headers: {
        Authorization: basicAuthHeader(credentials),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
      ...(signal ? { signal } : {}),
      forceRefresh: true,
    });

    const token = typeof data.access_token === "string" ? data.access_token.trim() : "";
    if (!token) {
      throw new FeedAdapterError(
        "upstream",
        "Reddit returned an unexpected token response. The API may have changed.",
        { providerId: PROVIDER_ID },
      );
    }

    const expiresIn =
      typeof data.expires_in === "number" && Number.isFinite(data.expires_in)
        ? Math.max(60, data.expires_in)
        : 3600;
    cachedToken = {
      clientId,
      token,
      expiresAt: now + expiresIn * 1000,
    };
    return token;
  } catch (error) {
    wrapError(error, "token");
  }
}

export type RedditAdapterOptions = {
  platform: ProviderPlatform;
  baseUrl?: string;
  tokenUrl?: string;
};

export function createRedditAdapter(options: RedditAdapterOptions): RedditAdapter {
  const baseUrl = (options.baseUrl ?? REDDIT_OAUTH_BASE).replace(/\/$/, "");
  const tokenUrl = options.tokenUrl ?? REDDIT_TOKEN_URL;

  return {
    id: PROVIDER_ID,

    isConfigured(credentials: RedditCredentials | null): boolean {
      return isConfigured(credentials);
    },

    async fetchSubreddit(
      request: RedditSubredditFetchRequest,
    ): Promise<RedditSubredditFetchResult> {
      if (!isConfigured(request.credentials)) {
        throw new FeedAdapterError(
          "not_configured",
          "Reddit API credentials are not configured on the server.",
          { providerId: PROVIDER_ID },
        );
      }

      try {
        const token = await fetchAccessToken(
          options.platform,
          request.credentials,
          tokenUrl,
          request.signal,
          request.forceRefresh,
        );

        const listingUrl = buildListingUrl(
          baseUrl,
          request.name,
          request.sort,
          request.limit,
          request.timeFrame,
        );

        const { data, result } = await options.platform.fetchJson<RedditListingResponse>({
          providerId: PROVIDER_ID,
          url: listingUrl,
          headers: {
            Authorization: `Bearer ${token}`,
          },
          ...(request.signal ? { signal: request.signal } : {}),
          ...(request.forceRefresh !== undefined ? { forceRefresh: request.forceRefresh } : {}),
          cachePolicy: { ttlSeconds: 120, staleWhileRevalidateSeconds: 600 },
        });

        const children = data.data?.children;
        if (!Array.isArray(children)) {
          throw new FeedAdapterError(
            "upstream",
            "Reddit returned an unexpected listing. The API may have changed.",
            { providerId: PROVIDER_ID },
          );
        }

        const posts: RedditPostPayload[] = [];
        for (const child of children) {
          if (!child?.data) {
            continue;
          }
          const post = toPost(child.data);
          if (post) {
            posts.push(post);
          }
        }

        return { posts, cacheStatus: result.cacheStatus };
      } catch (error) {
        wrapError(error, "listing");
      }
    },
  };
}

/** Test helper to reset in-memory token cache between tests. */
export function resetRedditTokenCacheForTests(): void {
  cachedToken = null;
}
