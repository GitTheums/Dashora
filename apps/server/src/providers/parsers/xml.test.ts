import { describe, expect, it } from "vitest";
import { XmlParseError, childText, collectText, findChild, parseXml } from "./xml.js";

describe("parseXml entity decoding", () => {
  it("decodes normal XML entities exactly once", () => {
    const root = parseXml("<root>&lt;tag&gt; &amp; &quot;q&quot; &apos;a&apos;</root>");
    expect(root.text).toBe(`<tag> & "q" 'a'`);
  });

  it("preserves already-decoded literal text", () => {
    const root = parseXml("<root>plain &lt;decoded&gt; text</root>");
    expect(root.text).toBe("plain <decoded> text");
  });

  it("keeps doubly encoded entities as a single decode", () => {
    // `&amp;lt;` must become `&lt;`, not `<` — second decode must not occur.
    const root = parseXml("<root>&amp;lt;script&amp;gt;</root>");
    expect(root.text).toBe("&lt;script&gt;");
    expect(root.text).not.toBe("<script>");
  });

  it("does not turn encoded HTML markup into active tags in the parse tree", () => {
    const root = parseXml("<item><title>&lt;img src=x onerror=alert(1)&gt;</title></item>");
    const title = childText(root, "title");
    expect(title).toBe("<img src=x onerror=alert(1)>");
    expect(findChild(root, "img")).toBeUndefined();
    expect(root.children).toHaveLength(1);
    expect(root.children[0]?.name).toBe("title");
  });

  it("decodes numeric character references once", () => {
    const root = parseXml("<root>&#60;hi&#62; &#x26; ok</root>");
    expect(root.text).toBe("<hi> & ok");
  });

  it("leaves malformed entities untouched", () => {
    const root = parseXml("<root>&amp &lt &unknown; &#xzz; &#999999999999;</root>");
    expect(root.text).toContain("&amp");
    expect(root.text).toContain("&lt");
    expect(root.text).toContain("&unknown;");
  });

  it("decodes attribute values once", () => {
    const root = parseXml(`<root title="&amp;lt;safe&amp;gt;"></root>`);
    expect(root.attributes["title"]).toBe("&lt;safe&gt;");
  });

  it("parses RSS and Atom samples without double-decoding titles", () => {
    const rss = parseXml(`<?xml version="1.0"?>
      <rss version="2.0"><channel>
        <item><title>A &amp; B &lt;C&gt;</title><description><![CDATA[<b>raw</b>]]></description></item>
      </channel></rss>`);
    const channel = findChild(rss, "channel");
    expect(channel).toBeDefined();
    const item = channel ? findChild(channel, "item") : undefined;
    expect(item).toBeDefined();
    if (!item) {
      throw new Error("expected RSS item");
    }
    expect(childText(item, "title")).toBe("A & B <C>");
    expect(childText(item, "description")).toBe("<b>raw</b>");

    const atom = parseXml(`<?xml version="1.0"?>
      <feed xmlns="http://www.w3.org/2005/Atom">
        <entry><title>Atom &amp;amp; title</title></entry>
      </feed>`);
    const entry = findChild(atom, "entry");
    expect(entry).toBeDefined();
    if (!entry) {
      throw new Error("expected Atom entry");
    }
    // Single decode: `&amp;amp;` → `&amp;` (not `&`)
    expect(childText(entry, "title")).toBe("Atom &amp; title");
    expect(collectText(entry)).toContain("&amp;");
  });

  it("rejects empty documents and does not expand custom DTD entities", () => {
    expect(() => parseXml("")).toThrow(XmlParseError);
    // Declared external entities are ignored — only the predefined XML set is decoded.
    const withDecl = parseXml("<!DOCTYPE foo><root>&xxe;</root>");
    expect(withDecl.text).toBe("&xxe;");
  });
});
