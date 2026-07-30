import { type XmlNode, findChild, findChildren } from "./xml.js";

function isImageType(type: string | undefined): boolean {
  if (!type) {
    return false;
  }
  return type.toLowerCase().startsWith("image/");
}

function isImageUrl(url: string): boolean {
  return /\.(avif|bmp|gif|jpe?g|png|svg|webp)(\?|#|$)/i.test(url);
}

/**
 * Best-effort image URL from enclosure / Media RSS fields.
 * Callers must still sanitize before exposing to the browser.
 */
export function extractMediaThumbnailUrl(node: XmlNode): string | undefined {
  const enclosure = findChild(node, "enclosure");
  const enclosureUrl = enclosure?.attributes["url"];
  const enclosureType = enclosure?.attributes["type"];
  if (enclosureUrl && (isImageType(enclosureType) || isImageUrl(enclosureUrl))) {
    return enclosureUrl;
  }

  const thumbnail = findChild(node, "thumbnail");
  if (thumbnail?.attributes["url"]) {
    return thumbnail.attributes["url"];
  }

  const mediaContents = findChildren(node, "content");
  for (const content of mediaContents) {
    const url = content.attributes["url"];
    if (!url) {
      continue;
    }
    const medium = content.attributes["medium"]?.toLowerCase();
    const type = content.attributes["type"];
    if (medium === "image" || isImageType(type) || isImageUrl(url)) {
      return url;
    }
  }

  return undefined;
}
