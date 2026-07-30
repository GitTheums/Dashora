import { ProviderError } from "../errors.js";
import { extractMediaThumbnailUrl } from "./media.js";
import { type XmlNode, childText, findChild, findChildren, localNameOf, parseXml } from "./xml.js";

export type RssFeed = {
  type: "rss";
  title?: string;
  link?: string;
  description?: string;
  items: RssItem[];
};

export type RssItem = {
  title?: string;
  link?: string;
  description?: string;
  guid?: string;
  pubDate?: string;
  author?: string;
  thumbnailUrl?: string;
};

function optionalFields<T extends Record<string, string | undefined>>(
  fields: T,
): {
  [K in keyof T]?: string;
} {
  const out: { [K in keyof T]?: string } = {};
  for (const key of Object.keys(fields) as (keyof T)[]) {
    const value = fields[key];
    if (value !== undefined) {
      out[key] = value;
    }
  }
  return out;
}

export function parseRssXml(xml: string): RssFeed {
  let root: XmlNode;
  try {
    root = parseXml(xml);
  } catch (error) {
    throw new ProviderError("parse_error", {
      message: "Upstream RSS response could not be parsed.",
      cause: error,
    });
  }

  if (localNameOf(root.name).toLowerCase() !== "rss") {
    throw new ProviderError("parse_error", {
      message: "Upstream XML is not an RSS document.",
    });
  }

  const channel = findChild(root, "channel");
  if (!channel) {
    throw new ProviderError("parse_error", {
      message: "RSS document is missing a channel element.",
    });
  }

  const items: RssItem[] = findChildren(channel, "item").map((item) =>
    optionalFields({
      title: childText(item, "title"),
      link: childText(item, "link"),
      description: childText(item, "description"),
      guid: childText(item, "guid"),
      pubDate: childText(item, "pubDate"),
      author: childText(item, "author") ?? childText(item, "creator"),
      thumbnailUrl: extractMediaThumbnailUrl(item),
    }),
  );

  return {
    type: "rss",
    ...optionalFields({
      title: childText(channel, "title"),
      link: childText(channel, "link"),
      description: childText(channel, "description"),
    }),
    items,
  };
}
