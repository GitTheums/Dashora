export type XmlAttributeMap = Record<string, string>;

export type XmlNode = {
  name: string;
  attributes: XmlAttributeMap;
  children: XmlNode[];
  text: string;
};

export class XmlParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "XmlParseError";
  }
}

/**
 * Minimal well-formed XML parser for feed/document helpers.
 * Supports elements, attributes, text, CDATA, comments, and processing instructions.
 * Does not expand entities beyond the predefined XML set, and does not resolve DTDs.
 */
export function parseXml(input: string): XmlNode {
  const source = input.replace(/^\uFEFF/, "").trim();
  if (!source) {
    throw new XmlParseError("Empty XML document");
  }

  let index = 0;
  const rootChildren: XmlNode[] = [];
  const stack: XmlNode[] = [];

  function peek(offset = 0): string {
    return source[index + offset] ?? "";
  }

  function startsWith(value: string): boolean {
    return source.startsWith(value, index);
  }

  function skipWhitespace(): void {
    while (/\s/.test(peek())) {
      index += 1;
    }
  }

  function readUntil(delimiter: string): string {
    const end = source.indexOf(delimiter, index);
    if (end < 0) {
      throw new XmlParseError(`Unterminated construct looking for ${delimiter}`);
    }
    const value = source.slice(index, end);
    index = end + delimiter.length;
    return value;
  }

  function decodeEntities(value: string): string {
    return value
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'");
  }

  function parseName(): string {
    const start = index;
    if (!/[A-Za-z_:]/.test(peek())) {
      throw new XmlParseError(`Expected name at position ${index}`);
    }
    index += 1;
    while (/[A-Za-z0-9._:-]/.test(peek())) {
      index += 1;
    }
    return source.slice(start, index);
  }

  function parseAttributes(): XmlAttributeMap {
    const attributes: XmlAttributeMap = {};
    while (true) {
      skipWhitespace();
      if (peek() === "/" || peek() === ">" || peek() === "") {
        break;
      }
      const name = parseName();
      skipWhitespace();
      if (peek() !== "=") {
        throw new XmlParseError(`Expected = after attribute ${name}`);
      }
      index += 1;
      skipWhitespace();
      const quote = peek();
      if (quote !== '"' && quote !== "'") {
        throw new XmlParseError(`Expected quoted attribute value for ${name}`);
      }
      index += 1;
      const end = source.indexOf(quote, index);
      if (end < 0) {
        throw new XmlParseError(`Unterminated attribute value for ${name}`);
      }
      attributes[name] = decodeEntities(source.slice(index, end));
      index = end + 1;
    }
    return attributes;
  }

  function appendText(text: string): void {
    if (!text) {
      return;
    }
    const current = stack[stack.length - 1];
    if (!current) {
      if (text.trim()) {
        throw new XmlParseError("Text content outside root element");
      }
      return;
    }
    current.text += text;
  }

  function pushNode(node: XmlNode): void {
    const parent = stack[stack.length - 1];
    if (parent) {
      parent.children.push(node);
    } else {
      rootChildren.push(node);
    }
    stack.push(node);
  }

  while (index < source.length) {
    if (startsWith("<!--")) {
      index += 4;
      readUntil("-->");
      continue;
    }
    if (startsWith("<![CDATA[")) {
      index += 9;
      appendText(readUntil("]]>"));
      continue;
    }
    if (startsWith("<?")) {
      index += 2;
      readUntil("?>");
      continue;
    }
    if (startsWith("<!")) {
      index += 2;
      readUntil(">");
      continue;
    }
    if (startsWith("</")) {
      index += 2;
      skipWhitespace();
      const name = parseName();
      skipWhitespace();
      if (peek() !== ">") {
        throw new XmlParseError(`Expected > closing tag for ${name}`);
      }
      index += 1;
      const current = stack.pop();
      if (!current || current.name !== name) {
        throw new XmlParseError(`Mismatched closing tag ${name}`);
      }
      continue;
    }
    if (peek() === "<") {
      index += 1;
      skipWhitespace();
      const name = parseName();
      const attributes = parseAttributes();
      skipWhitespace();
      const selfClosing = peek() === "/";
      if (selfClosing) {
        index += 1;
      }
      if (peek() !== ">") {
        throw new XmlParseError(`Expected > for element ${name}`);
      }
      index += 1;
      const node: XmlNode = { name, attributes, children: [], text: "" };
      if (selfClosing) {
        const parent = stack[stack.length - 1];
        if (parent) {
          parent.children.push(node);
        } else {
          rootChildren.push(node);
        }
      } else {
        pushNode(node);
      }
      continue;
    }

    const nextTag = source.indexOf("<", index);
    const raw = nextTag < 0 ? source.slice(index) : source.slice(index, nextTag);
    index = nextTag < 0 ? source.length : nextTag;
    appendText(decodeEntities(raw));
  }

  if (stack.length > 0) {
    throw new XmlParseError(`Unclosed element ${stack[stack.length - 1]?.name ?? "?"}`);
  }

  const elements = rootChildren.filter((node) => node.name);
  if (elements.length !== 1) {
    throw new XmlParseError("XML document must have exactly one root element");
  }
  const root = elements[0];
  if (!root) {
    throw new XmlParseError("XML document must have exactly one root element");
  }
  return root;
}

export function findChildren(node: XmlNode, localName: string): XmlNode[] {
  const needle = localName.toLowerCase();
  return node.children.filter((child) => localNameOf(child.name).toLowerCase() === needle);
}

export function findChild(node: XmlNode, localName: string): XmlNode | undefined {
  return findChildren(node, localName)[0];
}

export function childText(node: XmlNode, localName: string): string | undefined {
  const child = findChild(node, localName);
  if (!child) {
    return undefined;
  }
  const text = child.text.trim();
  if (text) {
    return text;
  }
  // RSS often nests text in <title><![CDATA[...]]></title> already flattened into text.
  return child.text.trim() || undefined;
}

export function localNameOf(name: string): string {
  const idx = name.indexOf(":");
  return idx >= 0 ? name.slice(idx + 1) : name;
}

export function collectText(node: XmlNode): string {
  if (node.text.trim()) {
    return node.text.trim();
  }
  return node.children.map(collectText).filter(Boolean).join(" ").trim();
}
