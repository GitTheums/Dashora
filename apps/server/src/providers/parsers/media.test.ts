import { describe, expect, it } from "vitest";
import { extractMediaThumbnailUrl } from "./media.js";
import { parseXml } from "./xml.js";

describe("extractMediaThumbnailUrl", () => {
  it("prefers image enclosures", () => {
    const node = parseXml(
      `<item><enclosure url="https://cdn.example.test/a.jpg" type="image/jpeg" /></item>`,
    );
    expect(extractMediaThumbnailUrl(node)).toBe("https://cdn.example.test/a.jpg");
  });

  it("reads media:thumbnail attributes", () => {
    const node = parseXml(
      `<item xmlns:media="http://search.yahoo.com/mrss/"><media:thumbnail url="https://cdn.example.test/thumb.png" /></item>`,
    );
    expect(extractMediaThumbnailUrl(node)).toBe("https://cdn.example.test/thumb.png");
  });

  it("reads image media:content and nested media:group entries", () => {
    const content = parseXml(
      `<item><content url="https://cdn.example.test/photo.webp" medium="image" /></item>`,
    );
    expect(extractMediaThumbnailUrl(content)).toBe("https://cdn.example.test/photo.webp");

    const group = parseXml(
      `<entry><group><thumbnail url="https://i.ytimg.com/vi/abc/hqdefault.jpg" /></group></entry>`,
    );
    expect(extractMediaThumbnailUrl(group)).toBe("https://i.ytimg.com/vi/abc/hqdefault.jpg");
  });

  it("ignores non-image enclosures", () => {
    const node = parseXml(
      `<item><enclosure url="https://cdn.example.test/a.mp3" type="audio/mpeg" /></item>`,
    );
    expect(extractMediaThumbnailUrl(node)).toBeUndefined();
  });
});
