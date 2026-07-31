/**
 * Safe, limited JSON path evaluation for Custom API mapping.
 * Supports `$.a.b[0].c` / `a.b[0].c` only — no filters, wildcards, or scripts.
 */

export type JsonPathSegment = { kind: "property"; name: string } | { kind: "index"; index: number };

const SEGMENT_RE = /([A-Za-z_][A-Za-z0-9_]*)|\[(\d+)\]/g;

export function parseJsonPath(path: string): JsonPathSegment[] | null {
  const trimmed = path.trim();
  if (!trimmed || trimmed.includes("..") || /[()@?*]/.test(trimmed)) {
    return null;
  }
  let input = trimmed.startsWith("$") ? trimmed.slice(1) : trimmed;
  if (input.startsWith(".")) {
    input = input.slice(1);
  }
  if (!input) {
    return [];
  }

  const segments: JsonPathSegment[] = [];
  let cursor = 0;
  SEGMENT_RE.lastIndex = 0;
  while (cursor < input.length) {
    if (input[cursor] === ".") {
      cursor += 1;
      continue;
    }
    SEGMENT_RE.lastIndex = cursor;
    const match = SEGMENT_RE.exec(input);
    if (!match || match.index !== cursor) {
      return null;
    }
    if (match[1]) {
      segments.push({ kind: "property", name: match[1] });
    } else if (match[2] !== undefined) {
      segments.push({ kind: "index", index: Number.parseInt(match[2], 10) });
    } else {
      return null;
    }
    cursor = SEGMENT_RE.lastIndex;
  }
  return segments;
}

export function readJsonPath(root: unknown, path: string): unknown {
  const segments = parseJsonPath(path);
  if (segments === null) {
    return undefined;
  }
  let current: unknown = root;
  for (const segment of segments) {
    if (current === null || current === undefined) {
      return undefined;
    }
    if (segment.kind === "property") {
      if (typeof current !== "object" || Array.isArray(current)) {
        return undefined;
      }
      current = (current as Record<string, unknown>)[segment.name];
      continue;
    }
    if (!Array.isArray(current)) {
      return undefined;
    }
    current = current[segment.index];
  }
  return current;
}

export function valueToPlainText(value: unknown, maxLength: number): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  let text: string;
  if (typeof value === "string") {
    text = value;
  } else if (typeof value === "number" || typeof value === "boolean") {
    text = String(value);
  } else {
    return null;
  }
  text = [...text]
    .filter((char) => {
      const code = char.charCodeAt(0);
      return code >= 32 && code !== 127;
    })
    .join("")
    .trim();
  if (!text) {
    return null;
  }
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

export function valueToNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}
