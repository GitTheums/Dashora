import { describe, expect, it } from "vitest";
import {
  DEFAULT_DASHBOARD_PAGES,
  createPageRequestSchema,
  pageSlugSchema,
  updatePageRequestSchema,
} from "./dashboard.js";

describe("dashboard shared schemas", () => {
  it("accepts valid page create payloads and default page catalog", () => {
    expect(DEFAULT_DASHBOARD_PAGES).toHaveLength(4);
    expect(DEFAULT_DASHBOARD_PAGES.map((page) => page.slug)).toEqual([
      "home",
      "markets",
      "gaming",
      "homelab",
    ]);

    const parsed = createPageRequestSchema.parse({
      name: "Ops",
      slug: "ops-board",
      icon: "wrench",
      accent: "#0EA5E9",
    });
    expect(parsed.icon).toBe("wrench");
  });

  it("normalizes and rejects invalid slugs", () => {
    expect(pageSlugSchema.parse(" Home-Lab ")).toBe("home-lab");
    expect(pageSlugSchema.safeParse("Bad Slug").success).toBe(false);
    expect(pageSlugSchema.safeParse("UPPER").success).toBe(true);
    expect(pageSlugSchema.parse("UPPER")).toBe("upper");
  });

  it("requires at least one field on update", () => {
    expect(updatePageRequestSchema.safeParse({}).success).toBe(false);
    expect(updatePageRequestSchema.parse({ name: "Renamed" }).name).toBe("Renamed");
  });
});
