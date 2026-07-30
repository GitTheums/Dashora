import { afterEach, describe, expect, it } from "vitest";
import { createTestServerEnv } from "../../test/env.js";
import { createProviderPlatform } from "../platform.js";
import { type MockUpstreamServer, startMockUpstream } from "../test/mock-upstream.js";
import { createPlatformRssFeedFetcher } from "./feed-fetcher.js";

describe("platform RSS feed fetcher", () => {
  let upstream: MockUpstreamServer | undefined;

  afterEach(async () => {
    if (upstream) {
      await upstream.close();
      upstream = undefined;
    }
  });

  it("parses RSS and Atom with thumbnails", async () => {
    upstream = await startMockUpstream((req, res) => {
      res.statusCode = 200;
      res.setHeader("content-type", "application/xml");
      if (req.url?.includes("atom")) {
        res.end(`<?xml version="1.0"?>
          <feed xmlns="http://www.w3.org/2005/Atom" xmlns:media="http://search.yahoo.com/mrss/">
            <title>Atom</title>
            <entry>
              <title>Entry</title>
              <link href="https://example.test/e"/>
              <summary>Hi</summary>
              <media:thumbnail url="https://cdn.example.test/e.jpg"/>
            </entry>
          </feed>`);
        return;
      }
      res.end(`<?xml version="1.0"?>
        <rss version="2.0">
          <channel>
            <title>News</title>
            <item>
              <title>One</title>
              <link>https://example.test/1</link>
              <enclosure url="https://cdn.example.test/1.jpg" type="image/jpeg" />
            </item>
          </channel>
        </rss>`);
    });

    const platform = createProviderPlatform({
      env: createTestServerEnv(),
      fetchImpl: globalThis.fetch,
    });
    const fetcher = createPlatformRssFeedFetcher(platform);

    const rss = await fetcher.fetchFeed(`${upstream.baseUrl}/rss.xml`);
    expect(rss.feed.type).toBe("rss");
    expect(rss.feed.items[0]?.thumbnailUrl).toBe("https://cdn.example.test/1.jpg");

    const atom = await fetcher.fetchFeed(`${upstream.baseUrl}/atom.xml`);
    expect(atom.feed.type).toBe("atom");
    expect(atom.feed.items[0]?.title).toBe("Entry");
    expect(atom.feed.items[0]?.thumbnailUrl).toBe("https://cdn.example.test/e.jpg");
  });
});
