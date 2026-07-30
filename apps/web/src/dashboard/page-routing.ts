/** Paths reserved by the auth/design-system shell — not used as page slugs in the URL. */
export const RESERVED_PATHS = new Set(["login", "setup", "design-system", "api"]);

export function pagePath(slug: string): string {
  return `/${slug}`;
}

export function readPageSlugFromPath(pathname: string = window.location.pathname): string | null {
  const trimmed = pathname.replace(/\/+$/, "") || "/";
  if (trimmed === "/") {
    return null;
  }
  const segments = trimmed.split("/").filter(Boolean);
  if (segments.length !== 1) {
    return null;
  }
  const slug = segments[0]?.toLowerCase() ?? null;
  if (!slug || RESERVED_PATHS.has(slug)) {
    return null;
  }
  return slug;
}

export function slugifyName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}
