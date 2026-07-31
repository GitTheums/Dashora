import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Locks in the current safe architecture: provider/feed content is only ever rendered as text
 * (see `stripHtmlToText` in `@dashora/widget-sdk`), never as HTML. This test scans the
 * TypeScript/TSX sources of every UI-rendering package (`apps/web`, `@dashora/ui`,
 * `@dashora/widget-sdk`) and fails if `dangerouslySetInnerHTML` is ever introduced as a JSX
 * prop. Introducing it anywhere would require re-evaluating with a real HTML sanitizer (e.g.
 * `sanitize-html`) first — see docs/security-model.md.
 */

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

const SCAN_ROOTS = [
  join(REPO_ROOT, "apps/web/src"),
  join(REPO_ROOT, "packages/ui/src"),
  join(REPO_ROOT, "packages/widget-sdk/src"),
];

const SOURCE_EXTENSIONS = new Set([".ts", ".tsx"]);
// JSX prop usage, e.g. `dangerouslySetInnerHTML={{ __html: ... }}` — deliberately requires the
// following `=` so mentions in comments/docs (like this file's own doc comment) don't match.
const DANGEROUS_PROP_PATTERN = /dangerouslySetInnerHTML\s*=/;

function collectSourceFiles(root: string): string[] {
  const files: string[] = [];
  const stack = [root];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) {
      continue;
    }
    for (const entry of readdirSync(current)) {
      if (entry === "node_modules" || entry === "dist") {
        continue;
      }
      const fullPath = join(current, entry);
      const stats = statSync(fullPath);
      if (stats.isDirectory()) {
        stack.push(fullPath);
        continue;
      }
      if (SOURCE_EXTENSIONS.has(fullPath.slice(fullPath.lastIndexOf(".")))) {
        files.push(fullPath);
      }
    }
  }
  return files;
}

describe("dangerouslySetInnerHTML regression guard", () => {
  it("is never used anywhere in the UI-rendering packages", () => {
    const offenders: string[] = [];
    for (const root of SCAN_ROOTS) {
      for (const file of collectSourceFiles(root)) {
        // Skip this guard's own source (it references the prop name in a string/comment, not
        // as JSX usage — excluded to keep the assertion unambiguous either way).
        if (file.endsWith("no-dangerous-html.test.ts")) {
          continue;
        }
        const content = readFileSync(file, "utf8");
        if (DANGEROUS_PROP_PATTERN.test(content)) {
          offenders.push(file);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
