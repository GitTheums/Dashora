import {
  FeedAdapterError,
  type TwitchAdapter,
  type TwitchChannelPayload,
  type TwitchChannelsFetchRequest,
  type TwitchChannelsFetchResult,
  type TwitchCredentials,
} from "@dashora/widget-sdk/widgets/twitch/server";
import { type ProviderError, isProviderError } from "../errors.js";
import type { ProviderPlatform } from "../platform.js";

const DEFAULT_API_BASE = "https://api.twitch.tv/helix";
const DEFAULT_TOKEN_URL = "https://id.twitch.tv/oauth2/token";
const PROVIDER_ID = "twitch";

type TokenResponse = {
  access_token?: string;
  expires_in?: number;
  token_type?: string;
};

type TwitchUser = {
  id?: string;
  login?: string;
  display_name?: string;
};

type TwitchStream = {
  id?: string;
  user_id?: string;
  user_login?: string;
  user_name?: string;
  game_name?: string;
  title?: string;
  viewer_count?: number;
  started_at?: string;
  thumbnail_url?: string;
  type?: string;
};

type HelixUsersResponse = {
  data?: TwitchUser[];
};

type HelixStreamsResponse = {
  data?: TwitchStream[];
};

type CachedToken = {
  clientId: string;
  token: string;
  expiresAt: number;
};

let cachedToken: CachedToken | null = null;

function mapTwitchError(error: ProviderError): FeedAdapterError {
  const status = error.statusCode;
  if (error.code === "rate_limited" || status === 429) {
    return new FeedAdapterError(
      "rate_limited",
      "Twitch API rate limit exceeded. Try again later.",
      { statusCode: status ?? 429, providerId: PROVIDER_ID, cause: error },
    );
  }
  if (status === 401 || status === 403) {
    return new FeedAdapterError(
      "unauthorized",
      "Twitch rejected the client credentials. Update TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET on the server.",
      { statusCode: status, providerId: PROVIDER_ID, cause: error },
    );
  }
  return new FeedAdapterError("upstream", "Could not load channels from Twitch.", {
    ...(status !== undefined ? { statusCode: status } : {}),
    providerId: PROVIDER_ID,
    cause: error,
  });
}

function normalizeThumbnail(url: string | undefined | null): string | null {
  if (!url) {
    return null;
  }
  return url.replace(/\{width\}x\{height\}/g, "320x180");
}

function mergeChannels(
  logins: string[],
  users: TwitchUser[],
  streams: TwitchStream[],
): TwitchChannelPayload[] {
  const usersByLogin = new Map<string, TwitchUser>();
  for (const user of users) {
    if (user.login) {
      usersByLogin.set(user.login.toLowerCase(), user);
    }
  }
  const streamsByLogin = new Map<string, TwitchStream>();
  for (const stream of streams) {
    if (stream.user_login) {
      streamsByLogin.set(stream.user_login.toLowerCase(), stream);
    }
  }

  const results: TwitchChannelPayload[] = [];
  for (const login of logins) {
    const key = login.toLowerCase();
    const user = usersByLogin.get(key);
    if (!user?.id || !user.login) {
      continue;
    }
    const stream = streamsByLogin.get(key);
    const isLive = Boolean(stream && stream.type === "live");
    results.push({
      id: user.id,
      login: user.login.toLowerCase(),
      displayName: user.display_name?.trim() || user.login,
      title: isLive ? (stream?.title?.trim() ?? null) : null,
      gameName: isLive ? (stream?.game_name?.trim() ?? null) : null,
      viewerCount:
        isLive && typeof stream?.viewer_count === "number" && Number.isFinite(stream.viewer_count)
          ? stream.viewer_count
          : 0,
      startedAt:
        isLive && stream?.started_at && Number.isFinite(Date.parse(stream.started_at))
          ? new Date(stream.started_at).toISOString()
          : null,
      url: `https://www.twitch.tv/${user.login.toLowerCase()}`,
      thumbnailUrl: isLive ? normalizeThumbnail(stream?.thumbnail_url) : null,
      isLive,
    });
  }
  return results;
}

export type TwitchAdapterOptions = {
  platform: ProviderPlatform;
  apiBaseUrl?: string;
  tokenUrl?: string;
};

async function fetchAccessToken(
  platform: ProviderPlatform,
  credentials: TwitchCredentials,
  tokenUrl: string,
  signal?: AbortSignal,
  forceRefresh?: boolean,
): Promise<string> {
  const clientId = credentials.clientId.trim();
  const clientSecret = credentials.clientSecret.trim();
  const now = Date.now();
  if (
    !forceRefresh &&
    cachedToken &&
    cachedToken.clientId === clientId &&
    cachedToken.expiresAt > now + 30_000
  ) {
    return cachedToken.token;
  }

  const tokenBody = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "client_credentials",
  });

  // Never SWR-cache token POSTs — the body contains the client secret.
  const { data: tokenJson } = await platform.fetchJson<TokenResponse>({
    providerId: `${PROVIDER_ID}:token`,
    url: tokenUrl,
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: tokenBody.toString(),
    ...(signal ? { signal } : {}),
    forceRefresh: true,
  });

  const accessToken = tokenJson.access_token?.trim();
  if (!accessToken) {
    throw new FeedAdapterError(
      "unauthorized",
      "Twitch rejected the client credentials. Update TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET on the server.",
      { providerId: PROVIDER_ID },
    );
  }

  const expiresIn =
    typeof tokenJson.expires_in === "number" && Number.isFinite(tokenJson.expires_in)
      ? Math.max(60, tokenJson.expires_in)
      : 3600;
  cachedToken = {
    clientId,
    token: accessToken,
    expiresAt: now + expiresIn * 1000,
  };
  return accessToken;
}

export function createTwitchAdapter(options: TwitchAdapterOptions): TwitchAdapter {
  const apiBaseUrl = (options.apiBaseUrl ?? DEFAULT_API_BASE).replace(/\/$/, "");
  const tokenUrl = options.tokenUrl ?? DEFAULT_TOKEN_URL;

  return {
    id: PROVIDER_ID,

    isConfigured(credentials: TwitchCredentials | null): boolean {
      return Boolean(credentials?.clientId.trim() && credentials?.clientSecret.trim());
    },

    async fetchChannels(request: TwitchChannelsFetchRequest): Promise<TwitchChannelsFetchResult> {
      if (!this.isConfigured(request.credentials)) {
        throw new FeedAdapterError(
          "not_configured",
          "Set TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET on the server to load Twitch channels.",
          { providerId: PROVIDER_ID },
        );
      }

      const logins = [...new Set(request.logins.map((login) => login.toLowerCase()))].filter(
        Boolean,
      );
      if (logins.length === 0) {
        return { channels: [], cacheStatus: "bypass" };
      }

      const clientId = request.credentials.clientId.trim();

      try {
        const accessToken = await fetchAccessToken(
          options.platform,
          request.credentials,
          tokenUrl,
          request.signal,
          request.forceRefresh,
        );

        const helixHeaders = {
          "Client-Id": clientId,
          Authorization: `Bearer ${accessToken}`,
        };

        const usersUrl = new URL(`${apiBaseUrl}/users`);
        for (const login of logins) {
          usersUrl.searchParams.append("login", login);
        }

        const { data: usersJson, result: usersResult } =
          await options.platform.fetchJson<HelixUsersResponse>({
            providerId: PROVIDER_ID,
            url: usersUrl.toString(),
            headers: helixHeaders,
            ...(request.signal ? { signal: request.signal } : {}),
            ...(request.forceRefresh !== undefined ? { forceRefresh: request.forceRefresh } : {}),
            cachePolicy: { ttlSeconds: 60, staleWhileRevalidateSeconds: 120 },
          });

        const streamsUrl = new URL(`${apiBaseUrl}/streams`);
        for (const login of logins) {
          streamsUrl.searchParams.append("user_login", login);
        }

        const { data: streamsJson, result: streamsResult } =
          await options.platform.fetchJson<HelixStreamsResponse>({
            providerId: PROVIDER_ID,
            url: streamsUrl.toString(),
            headers: helixHeaders,
            ...(request.signal ? { signal: request.signal } : {}),
            ...(request.forceRefresh !== undefined ? { forceRefresh: request.forceRefresh } : {}),
            cachePolicy: { ttlSeconds: 60, staleWhileRevalidateSeconds: 120 },
          });

        const channels = mergeChannels(logins, usersJson.data ?? [], streamsJson.data ?? []);

        let cacheStatus = usersResult.cacheStatus;
        if (usersResult.cacheStatus === "stale" || streamsResult.cacheStatus === "stale") {
          cacheStatus = "stale";
        } else if (cacheStatus === "hit" && streamsResult.cacheStatus !== "hit") {
          cacheStatus = streamsResult.cacheStatus;
        }

        return { channels, cacheStatus };
      } catch (error) {
        if (error instanceof FeedAdapterError) {
          throw error;
        }
        if (isProviderError(error)) {
          throw mapTwitchError(error);
        }
        throw new FeedAdapterError("upstream", "Could not load channels from Twitch.", {
          providerId: PROVIDER_ID,
          cause: error,
        });
      }
    },
  };
}
