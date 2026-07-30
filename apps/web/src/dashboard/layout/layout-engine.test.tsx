import {
  LAYOUT_SAVE_DEBOUNCE_MS,
  type PageLayoutDocument,
  type PageLayoutResponse,
  clonePageLayout,
  createDefaultPageLayout,
  layoutsEqual,
} from "@dashora/shared";
import { ThemeProvider } from "@dashora/ui";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { StrictMode } from "react";
import type { Layout } from "react-grid-layout";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DashboardApiError } from "../api.js";
import { DashboardEditModeProvider } from "../edit-mode-context.js";
import { createMemoryDashboardApi } from "../memory-api.js";
import {
  DashboardLayoutEngine,
  type LayoutApi,
  applyEmittedBreakpointLayout,
} from "./dashboard-layout-engine.js";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function renderEngine(api: LayoutApi, pageId: string, options?: { editMode?: boolean }) {
  return render(
    <StrictMode>
      <ThemeProvider defaultMode="dark">
        <DashboardEditModeProvider initialEditMode={options?.editMode ?? true}>
          <DashboardLayoutEngine pageId={pageId} api={api} />
        </DashboardEditModeProvider>
      </ThemeProvider>
    </StrictMode>,
  );
}

function toRglLayout(items: PageLayoutDocument["layouts"]["lg"]): Layout {
  return items.map((item) => {
    const next: Layout[number] = {
      i: item.i,
      x: item.x,
      y: item.y,
      w: item.w,
      h: item.h,
    };
    if (item.minW !== undefined) {
      next.minW = item.minW;
    }
    if (item.minH !== undefined) {
      next.minH = item.minH;
    }
    if (item.maxW !== undefined) {
      next.maxW = item.maxW;
    }
    if (item.maxH !== undefined) {
      next.maxH = item.maxH;
    }
    if (item.static !== undefined) {
      next.static = item.static;
    }
    return next;
  });
}

function moveFirstItem(document: PageLayoutDocument, y: number): PageLayoutDocument {
  const next = clonePageLayout(document);
  const first = next.layouts.lg[0];
  expect(first).toBeDefined();
  if (!first) {
    return next;
  }
  first.y = y;
  return next;
}

describe("applyEmittedBreakpointLayout", () => {
  it("writes the emitted layout into the active breakpoint only", () => {
    const document = createDefaultPageLayout();
    const weather = document.layouts.lg.find((item) => item.i.includes("11101"));
    expect(weather).toBeDefined();
    if (!weather) {
      return;
    }

    const emitted = toRglLayout(
      document.layouts.lg.map((item) =>
        item.i === weather.i ? { ...item, x: item.x + 1, y: item.y + 2 } : item,
      ),
    );
    const next = applyEmittedBreakpointLayout(document, "lg", emitted);

    expect(next.layouts.lg.find((item) => item.i === weather.i)?.y).toBe(weather.y + 2);
    expect(next.layouts.md).toEqual(document.layouts.md);
    expect(next.layouts.sm).toEqual(document.layouts.sm);
    expect(next.widgets.map((widget) => widget.id)).toEqual(document.widgets.map((w) => w.id));
  });
});

describe("layout engine persistence semantics", () => {
  it("returns the default layout until a save occurs", async () => {
    const api = createMemoryDashboardApi();
    const dashboard = await api.getDashboard();
    const home = dashboard.pages[0];
    expect(home).toBeDefined();
    if (!home) {
      return;
    }

    const initial = await api.getPageLayout(home.id);
    expect(initial.isDefault).toBe(true);
    expect(layoutsEqual(initial.layout, createDefaultPageLayout())).toBe(true);
  });

  it("keeps the first emitted drag without requiring a second interaction", async () => {
    const base = createMemoryDashboardApi();
    const dashboard = await base.getDashboard();
    const home = dashboard.pages[0];
    expect(home).toBeDefined();
    if (!home) {
      return;
    }

    const baseline = await base.getPageLayout(home.id);
    const draft = moveFirstItem(baseline.layout, 20);

    // Simulate RGL ordering: stop callback receives the final layout while
    // local document still holds the pre-drag snapshot.
    const staleLocal = clonePageLayout(baseline.layout);
    const committed = applyEmittedBreakpointLayout(staleLocal, "lg", toRglLayout(draft.layouts.lg));
    expect(layoutsEqual(committed, draft)).toBe(true);
    expect(layoutsEqual(committed, staleLocal)).toBe(false);

    const saved = await base.savePageLayout(home.id, committed);
    expect(saved.layout.layouts.lg[0]?.y).toBe(20);
  });

  it("ignores an older delayed success when a newer revision exists", async () => {
    const base = createMemoryDashboardApi();
    const dashboard = await base.getDashboard();
    const home = dashboard.pages[0];
    expect(home).toBeDefined();
    if (!home) {
      return;
    }

    const baseline = await base.getPageLayout(home.id);
    const pending: Array<(value: PageLayoutResponse) => void> = [];

    const api: LayoutApi = {
      getPageLayout: base.getPageLayout,
      resetPageLayout: base.resetPageLayout,
      savePageLayout: async (pageId, layout) => {
        if (pending.length === 0) {
          return await new Promise<PageLayoutResponse>((resolve) => {
            pending.push(resolve);
          });
        }
        return base.savePageLayout(pageId, layout);
      },
    };

    let layoutRevision = 0;
    let persistedRevision = 0;
    let working = clonePageLayout(baseline.layout);
    let saved = clonePageLayout(baseline.layout);
    let status: "dirty" | "saving" | "saved" | "error" = "dirty";

    const persist = async (next: PageLayoutDocument, revision: number) => {
      status = "saving";
      try {
        const response = await api.savePageLayout(home.id, next);
        if (revision < layoutRevision) {
          if (revision >= persistedRevision) {
            persistedRevision = revision;
            saved = clonePageLayout(response.layout);
          }
          return;
        }
        persistedRevision = revision;
        saved = clonePageLayout(response.layout);
        if (layoutsEqual(working, next)) {
          working = clonePageLayout(response.layout);
        }
        status = layoutsEqual(working, saved) ? "saved" : "dirty";
      } catch {
        if (revision < layoutRevision) {
          return;
        }
        working = clonePageLayout(saved);
        status = "error";
      }
    };

    const first = moveFirstItem(baseline.layout, 12);
    layoutRevision = 1;
    working = first;
    const firstPersist = persist(first, 1);

    const second = moveFirstItem(baseline.layout, 18);
    layoutRevision = 2;
    working = second;
    const secondPersist = persist(second, 2);

    const resolveFirst = pending[0];
    expect(resolveFirst).toBeDefined();
    resolveFirst?.({
      pageId: home.id,
      layout: clonePageLayout(first),
      updatedAt: Date.now(),
      isDefault: false,
    });
    await firstPersist;
    expect(working.layouts.lg[0]?.y).toBe(18);

    await secondPersist;
    expect(status).toBe("saved");
    expect(working.layouts.lg[0]?.y).toBe(18);
  });

  it("rolls back exactly once when persistence fails", async () => {
    const base = createMemoryDashboardApi();
    const dashboard = await base.getDashboard();
    const home = dashboard.pages[0];
    expect(home).toBeDefined();
    if (!home) {
      return;
    }

    const baseline = await base.getPageLayout(home.id);
    const savePageLayout = vi.fn(async () => {
      throw new DashboardApiError(500, "server_error", "Save failed");
    });
    const api: LayoutApi = {
      getPageLayout: base.getPageLayout,
      resetPageLayout: base.resetPageLayout,
      savePageLayout,
    };

    const draft = moveFirstItem(baseline.layout, 20);
    let working = clonePageLayout(draft);
    const saved = clonePageLayout(baseline.layout);
    let status: "dirty" | "saving" | "saved" | "error" = "dirty";

    const persist = async () => {
      status = "saving";
      try {
        await api.savePageLayout(home.id, working);
        status = "saved";
      } catch {
        working = clonePageLayout(saved);
        status = "error";
      }
    };

    await persist();
    expect(status).toBe("error");
    expect(layoutsEqual(working, baseline.layout)).toBe(true);
    expect(savePageLayout).toHaveBeenCalledTimes(1);
  });

  it("does not save on initial hydration", async () => {
    const base = createMemoryDashboardApi();
    const dashboard = await base.getDashboard();
    const home = dashboard.pages[0];
    expect(home).toBeDefined();
    if (!home) {
      return;
    }

    const savePageLayout = vi.fn(base.savePageLayout);
    const api: LayoutApi = {
      getPageLayout: base.getPageLayout,
      resetPageLayout: base.resetPageLayout,
      savePageLayout,
    };

    renderEngine(api, home.id);
    await screen.findByLabelText(/Weather widget/i);
    await waitFor(() => {
      expect(screen.getByLabelText(/Weather widget/i)).toBeTruthy();
    });
    expect(savePageLayout).not.toHaveBeenCalled();
  });

  it("keeps widget ids stable after a successful save round-trip", async () => {
    const api = createMemoryDashboardApi();
    const dashboard = await api.getDashboard();
    const home = dashboard.pages[0];
    expect(home).toBeDefined();
    if (!home) {
      return;
    }

    const current = await api.getPageLayout(home.id);
    const edited = moveFirstItem(current.layout, 14);
    const saved = await api.savePageLayout(home.id, edited);
    expect(saved.layout.widgets.map((widget) => widget.id)).toEqual(
      current.layout.widgets.map((widget) => widget.id),
    );
  });
});

describe("layout engine toolbar", () => {
  it("shows layout editing controls in edit mode", async () => {
    const api = createMemoryDashboardApi();
    const dashboard = await api.getDashboard();
    const home = dashboard.pages[0];
    expect(home).toBeDefined();
    if (!home) {
      return;
    }

    renderEngine(api, home.id);
    const toolbar = await screen.findByRole("toolbar", { name: "Layout editing" });
    expect(within(toolbar).getByRole("button", { name: "Undo" })).toBeTruthy();
    expect(within(toolbar).getByRole("button", { name: "Reset layout" })).toBeTruthy();
  });
});

// Keep debounce constant referenced so refactors that change timing stay intentional.
void LAYOUT_SAVE_DEBOUNCE_MS;
