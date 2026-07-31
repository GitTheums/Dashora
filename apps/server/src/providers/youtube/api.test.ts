import { afterEach, describe, expect, it } from "vitest";
import { createTestServerEnv } from "../../test/env.js";
import { createProviderPlatform } from "../platform.js";
import { startMockUpstream } from "../test/mock-upstream.js";
import { createYoutubeAdapter } from "./api.js";

const atomFixture = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns:media="http://search.yahoo.com/mrss/">
  <title>Fixture Channel</title>
  <link rel="alternate" href="https://www.youtube.com/channel/UCfixturechannel123456789"/>
  <entry>
    <id>yt:video:abc123def45</id>
    <title>Fixture upload</title>
    <link rel="alternate" href="https://www.youtube.com/watch?v=abc123def45"/>
    <published>2026-07-30T10:00:00+00:00</published>
    <media:group>
      <media:thumbnail url="https://i.ytimg.com/vi/abc123def45/hqdefault.jpg"/>
    </media:group>
  </entry>
  <entry>
    <id>yt:video:xyz789ghi01</id>
    <title>Second upload</title>
    <link rel="alternate" href="https://www.youtube.com/watch?v=xyz789ghi01"/>
    <published>2026-07-29T08:00:00+00:00</published>
  </entry>
</feed>`;

describe("youtube adapter", () => {
  let closeUpstream: (() => Promise<void>) | undefined;

  afterEach(async () => {
    if (closeUpstream) {
      await closeUpstream();
      closeUpstream = undefined;
    }
  });

  it("parses Atom channel feed fixtures into videos", async () => {
    const upstream = await startMockUpstream((req, res) => {
      res.setHeader("content-type", "application/atom+xml");
      if (req.url?.includes("/feeds/videos.xml")) {
        res.end(atomFixture);
        return;
      }
      res.statusCode = 404;
      res.end("not found");
    });
    closeUpstream = upstream.close;

    const platform = createProviderPlatform({ env: createTestServerEnv() });
    const adapter = createYoutubeAdapter({ platform, feedBaseUrl: upstream.baseUrl });
    const result = await adapter.fetchChannel({
      channelId: "UCfixturechannel123456789",
      limit: 5,
    });

    expect(result.channelTitle).toBe("Fixture Channel");
    expect(result.videos).toHaveLength(2);
    expect(result.videos[0]?.title).toBe("Fixture upload");
    expect(result.videos[0]?.url).toBe("https://www.youtube.com/watch?v=abc123def45");
    expect(result.videos[0]?.thumbnailUrl).toBe("https://i.ytimg.com/vi/abc123def45/hqdefault.jpg");
    expect(result.videos[0]?.publishedAt).toBeTruthy();
  });

  it("maps 404 responses to not_found", async () => {
    const upstream = await startMockUpstream((_req, res) => {
      res.statusCode = 404;
      res.end("missing");
    });
    closeUpstream = upstream.close;

    const platform = createProviderPlatform({ env: createTestServerEnv() });
    const adapter = createYoutubeAdapter({ platform, feedBaseUrl: upstream.baseUrl });

    await expect(
      adapter.fetchChannel({ channelId: "UCfixturechannel123456789", limit: 1 }),
    ).rejects.toMatchObject({
      code: "not_found",
      providerId: "youtube",
    });
  });
});
