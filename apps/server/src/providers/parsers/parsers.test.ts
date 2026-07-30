import { describe, expect, it } from "vitest";
import { parseAtomXml, parseRssXml, parseXml } from "../parsers/index.js";

describe("provider parsers", () => {
  it("parses XML documents", () => {
    const doc = parseXml(`<?xml version="1.0"?><root attr="1"><child>hi</child></root>`);
    expect(doc.name).toBe("root");
    expect(doc.attributes["attr"]).toBe("1");
    expect(doc.children[0]?.text).toBe("hi");
  });

  it("parses RSS feeds", () => {
    const feed = parseRssXml(`<?xml version="1.0"?>
      <rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/">
        <channel>
          <title>Dashora News</title>
          <link>https://example.test</link>
          <item>
            <title>Hello</title>
            <link>https://example.test/1</link>
            <guid>1</guid>
            <description>Body</description>
            <enclosure url="https://cdn.example.test/a.jpg" type="image/jpeg" />
          </item>
        </channel>
      </rss>`);
    expect(feed.type).toBe("rss");
    expect(feed.title).toBe("Dashora News");
    expect(feed.items).toHaveLength(1);
    expect(feed.items[0]?.title).toBe("Hello");
    expect(feed.items[0]?.thumbnailUrl).toBe("https://cdn.example.test/a.jpg");
  });

  it("parses Atom feeds", () => {
    const feed = parseAtomXml(`<?xml version="1.0"?>
      <feed xmlns="http://www.w3.org/2005/Atom">
        <title>Atom Feed</title>
        <link href="https://example.test/" rel="alternate"/>
        <entry>
          <title>Entry</title>
          <id>urn:1</id>
          <link href="https://example.test/e1"/>
          <summary>Summary</summary>
        </entry>
      </feed>`);
    expect(feed.type).toBe("atom");
    expect(feed.title).toBe("Atom Feed");
    expect(feed.link).toBe("https://example.test/");
    expect(feed.entries[0]?.title).toBe("Entry");
    expect(feed.entries[0]?.link).toBe("https://example.test/e1");
  });
});
