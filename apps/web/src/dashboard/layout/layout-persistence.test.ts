import {
  LAYOUT_SAVE_DEBOUNCE_MS,
  clonePageLayout,
  createDefaultPageLayout,
  layoutsEqual,
} from "@dashora/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DashboardApiError } from "../api.js";
import { createMemoryDashboardApi } from "../memory-api.js";

describe("layout persistence (memory API)", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns the default layout until a save occurs", async () => {
    const api = createMemoryDashboardApi();
    const dashboard = await api.getDashboard();
    const home = dashboard.pages.find((page) => page.slug === "home");
    expect(home).toBeDefined();
    if (!home) {
      return;
    }

    const initial = await api.getPageLayout(home.id);
    expect(initial.isDefault).toBe(true);
    expect(layoutsEqual(initial.layout, createDefaultPageLayout())).toBe(true);
  });

  it("persists per-breakpoint layouts and can reset", async () => {
    const api = createMemoryDashboardApi();
    const dashboard = await api.getDashboard();
    const home = dashboard.pages[0];
    expect(home).toBeDefined();
    if (!home) {
      return;
    }

    const current = await api.getPageLayout(home.id);
    const edited = clonePageLayout(current.layout);
    const status = edited.widgets.find((widget) => widget.title === "Status");
    expect(status).toBeDefined();
    if (!status) {
      return;
    }
    const lgItem = edited.layouts.lg.find((item) => item.i === status.id);
    const mdItem = edited.layouts.md.find((item) => item.i === status.id);
    const smItem = edited.layouts.sm.find((item) => item.i === status.id);
    expect(lgItem && mdItem && smItem).toBeTruthy();
    if (!lgItem || !mdItem || !smItem) {
      return;
    }
    lgItem.y += 1;
    mdItem.y += 1;
    smItem.y += 1;

    const saved = await api.savePageLayout(home.id, edited);
    expect(saved.isDefault).toBe(false);
    expect(saved.layout.layouts.lg.find((item) => item.i === status.id)?.y).toBe(lgItem.y);
    expect(saved.layout.layouts.md.find((item) => item.i === status.id)?.y).toBe(mdItem.y);
    expect(saved.layout.layouts.sm.find((item) => item.i === status.id)?.y).toBe(smItem.y);

    const reloaded = await api.getPageLayout(home.id);
    expect(layoutsEqual(reloaded.layout, edited)).toBe(true);

    const reset = await api.resetPageLayout(home.id);
    expect(layoutsEqual(reset.layout, createDefaultPageLayout())).toBe(true);
  });

  it("rejects invalid layouts before persisting", async () => {
    const api = createMemoryDashboardApi();
    const dashboard = await api.getDashboard();
    const home = dashboard.pages[0];
    expect(home).toBeDefined();
    if (!home) {
      return;
    }

    await expect(
      api.savePageLayout(home.id, {
        version: 1,
        widgets: [
          {
            kind: "placeholder",
            id: "orphan",
            title: "Orphan",
            tone: "default",
            enabled: true,
          },
        ],
        layouts: { lg: [], md: [], sm: [] },
      }),
    ).rejects.toThrow();
  });

  it("models debounced save + failed-save rollback semantics", async () => {
    vi.useFakeTimers();
    const base = createMemoryDashboardApi();
    const dashboard = await base.getDashboard();
    const home = dashboard.pages[0];
    expect(home).toBeDefined();
    if (!home) {
      return;
    }

    const baseline = await base.getPageLayout(home.id);
    let shouldFail = true;
    const api = {
      ...base,
      savePageLayout: vi.fn(async (pageId: string, layout: typeof baseline.layout) => {
        if (shouldFail) {
          throw new DashboardApiError(500, "server_error", "Save failed");
        }
        return base.savePageLayout(pageId, layout);
      }),
    };

    const draft = clonePageLayout(baseline.layout);
    const first = draft.layouts.lg[0];
    expect(first).toBeDefined();
    if (!first) {
      return;
    }
    // Move into free space below the default packed region.
    first.y = 20;

    let working = clonePageLayout(draft);
    let saved = clonePageLayout(baseline.layout);
    let status: "dirty" | "saving" | "saved" | "error" = "dirty";

    const persist = async () => {
      status = "saving";
      try {
        const response = await api.savePageLayout(home.id, working);
        saved = clonePageLayout(response.layout);
        working = clonePageLayout(response.layout);
        status = "saved";
      } catch {
        working = clonePageLayout(saved);
        status = "error";
      }
    };

    const timer = setTimeout(() => {
      void persist();
    }, LAYOUT_SAVE_DEBOUNCE_MS);

    expect(status).toBe("dirty");
    await vi.advanceTimersByTimeAsync(LAYOUT_SAVE_DEBOUNCE_MS);
    await Promise.resolve();
    clearTimeout(timer);

    expect(status).toBe("error");
    expect(layoutsEqual(working, baseline.layout)).toBe(true);

    shouldFail = false;
    working = clonePageLayout(draft);
    status = "dirty";
    await persist();
    expect(status).toBe("saved");
    expect(layoutsEqual(working, draft)).toBe(true);
  });
});
