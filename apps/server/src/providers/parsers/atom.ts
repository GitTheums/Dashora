import { ProviderError } from "../errors.js";
import { extractMediaThumbnailUrl } from "./media.js";
import { type XmlNode, childText, findChildren, localNameOf, parseXml } from "./xml.js";

export type AtomFeed = {
  type: "atom";
  title?: string;
  subtitle?: string;
  id?: string;
  updated?: string;
  link?: string;
  entries: AtomEntry[];
};

export type AtomEntry = {
  title?: string;
  id?: string;
  updated?: string;
  published?: string;
  summary?: string;
  content?: string;
  link?: string;
  author?: string;
  thumbnailUrl?: string;
};

function atomLinkHref(node: XmlNode): string | undefined {
  const links = findChildren(node, "link");
  const alternate = links.find((link) => {
    const rel = link.attributes["rel"]?.toLowerCase();
    return !rel || rel === "alternate";
  });
  return (alternate ?? links[0])?.attributes["href"];
}

function atomAuthorName(node: XmlNode): string | undefined {
  const author = findChildren(node, "author")[0];
  if (!author) {
    return undefined;
  }
  return childText(author, "name") ?? (author.text.trim() || undefined);
}

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

export function parseAtomXml(xml: string): AtomFeed {
  let root: XmlNode;
  try {
    root = parseXml(xml);
  } catch (error) {
    throw new ProviderError("parse_error", {
      message: "Upstream Atom response could not be parsed.",
      cause: error,
    });
  }

  if (localNameOf(root.name).toLowerCase() !== "feed") {
    throw new ProviderError("parse_error", {
      message: "Upstream XML is not an Atom feed.",
    });
  }

  const entries: AtomEntry[] = findChildren(root, "entry").map((entry) =>
    optionalFields({
      title: childText(entry, "title"),
      id: childText(entry, "id"),
      updated: childText(entry, "updated"),
      published: childText(entry, "published"),
      summary: childText(entry, "summary"),
      content: childText(entry, "content"),
      link: atomLinkHref(entry),
      author: atomAuthorName(entry),
      thumbnailUrl: extractMediaThumbnailUrl(entry),
    }),
  );

  return {
    type: "atom",
    ...optionalFields({
      title: childText(root, "title"),
      subtitle: childText(root, "subtitle"),
      id: childText(root, "id"),
      updated: childText(root, "updated"),
      link: atomLinkHref(root),
    }),
    entries,
  };
}
