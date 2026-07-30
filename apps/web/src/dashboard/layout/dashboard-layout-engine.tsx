import type {
  BreakpointLayouts,
  LayoutBreakpoint,
  LayoutItem,
  PageLayoutDocument,
  PageLayoutResponse,
  PageWidget,
} from "@dashora/shared";
import {
  LAYOUT_BREAKPOINTS,
  LAYOUT_COLS,
  LAYOUT_MARGIN,
  LAYOUT_ROW_HEIGHT,
  LAYOUT_SAVE_DEBOUNCE_MS,
  addWidgetToLayout,
  clonePageLayout,
  createDefaultPageLayout,
  duplicateWidgetInLayout,
  layoutsEqual,
  moveLayoutItem,
  pageLayoutDocumentSchema,
  removeWidgetFromLayout,
  resolveBreakpoint,
  updateWidgetInLayout,
} from "@dashora/shared";
import { Button, EmptyState, Skeleton, cx } from "@dashora/ui";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  type Layout,
  Responsive,
  type ResponsiveLayouts,
  useContainerWidth,
  verticalCompactor,
} from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import { useDashboardEditMode } from "../edit-mode-context.js";
import {
  type WidgetCatalogEntry,
  catalogEntryForInstance,
  createInstanceFromCatalog,
  newWidgetInstanceId,
  shouldOpenSettingsAfterAdd,
} from "../widget-library/catalog.js";
import { WidgetLibraryDrawer } from "../widget-library/widget-library-drawer.js";
import {
  WidgetSettingsDrawer,
  resetWidgetConfig,
} from "../widget-settings/widget-settings-drawer.js";
import { WidgetInstanceCard } from "../widgets/instance-card.js";
import {
  DASHORA_WIDGET_DRAG_CANCEL_SELECTOR,
  DASHORA_WIDGET_DRAG_HANDLE_SELECTOR,
} from "./drag-config.js";

export type LayoutApi = {
  getPageLayout: (pageId: string) => Promise<PageLayoutResponse>;
  savePageLayout: (pageId: string, layout: PageLayoutDocument) => Promise<PageLayoutResponse>;
  resetPageLayout: (pageId: string) => Promise<PageLayoutResponse>;
};

export type SaveStatus = "idle" | "dirty" | "saving" | "saved" | "error";

export type DashboardLayoutEngineProps = {
  pageId: string;
  api: LayoutApi;
};

function toRglItem(item: LayoutItem): Layout[number] {
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
}

function toRglLayouts(layouts: BreakpointLayouts): ResponsiveLayouts<LayoutBreakpoint> {
  return {
    lg: layouts.lg.map(toRglItem),
    md: layouts.md.map(toRglItem),
    sm: layouts.sm.map(toRglItem),
  };
}

function serializeBreakpoint(layout: LayoutItem[]): string {
  return JSON.stringify(
    [...layout]
      .map((item) => ({ i: item.i, x: item.x, y: item.y, w: item.w, h: item.h }))
      .sort((a, b) => a.i.localeCompare(b.i)),
  );
}

function mergeBreakpointLayout(incoming: Layout | undefined, previous: LayoutItem[]): LayoutItem[] {
  if (!incoming) {
    return previous;
  }
  const previousById = new Map(previous.map((item) => [item.i, item]));
  return incoming.map((item) => {
    const prior = previousById.get(item.i);
    const next: LayoutItem = {
      i: item.i,
      x: item.x,
      y: item.y,
      w: item.w,
      h: item.h,
    };
    const minW = item.minW ?? prior?.minW;
    const minH = item.minH ?? prior?.minH;
    const maxW = item.maxW ?? prior?.maxW;
    const maxH = item.maxH ?? prior?.maxH;
    const isStatic = item.static ?? prior?.static;
    if (minW !== undefined && minW !== null) {
      next.minW = minW;
    }
    if (minH !== undefined && minH !== null) {
      next.minH = minH;
    }
    if (maxW !== undefined && maxW !== null) {
      next.maxW = maxW;
    }
    if (maxH !== undefined && maxH !== null) {
      next.maxH = maxH;
    }
    if (isStatic !== undefined) {
      next.static = isStatic;
    }
    return next;
  });
}

function fromRglLayouts(
  all: ResponsiveLayouts<LayoutBreakpoint>,
  fallback: BreakpointLayouts,
): BreakpointLayouts {
  return {
    lg: mergeBreakpointLayout(all.lg, fallback.lg),
    md: mergeBreakpointLayout(all.md, fallback.md),
    sm: mergeBreakpointLayout(all.sm, fallback.sm),
  };
}

/** Apply an RGL-emitted layout for one breakpoint onto the page document. */
export function applyEmittedBreakpointLayout(
  document: PageLayoutDocument,
  breakpoint: LayoutBreakpoint,
  emitted: Layout,
): PageLayoutDocument {
  return {
    ...document,
    layouts: {
      ...document.layouts,
      [breakpoint]: mergeBreakpointLayout(emitted, document.layouts[breakpoint]),
    },
  };
}

function isDev(): boolean {
  return Boolean(import.meta.env?.DEV) && import.meta.env?.MODE !== "test";
}

function layoutDebug(message: string, payload: Record<string, unknown>): void {
  if (!isDev()) {
    return;
  }
  console.debug(`[dashora:layout] ${message}`, payload);
}

function statusLabel(status: SaveStatus, dirty: boolean): string {
  if (dirty && status !== "saving" && status !== "error") {
    return "Unsaved changes";
  }
  switch (status) {
    case "dirty":
      return "Unsaved changes";
    case "saving":
      return "Saving…";
    case "saved":
      return "Layout saved";
    case "error":
      return "Save failed — rolled back";
    default:
      return "Layout up to date";
  }
}

export function DashboardLayoutEngine({ pageId, api }: DashboardLayoutEngineProps) {
  const {
    editMode,
    enterEditMode,
    pendingConfigureWidgetId,
    clearPendingConfigureWidgetId,
    registerBeforeExit,
  } = useDashboardEditMode();
  const { width, containerRef, mounted, measureWidth } = useContainerWidth({
    measureBeforeMount: true,
  });
  const [document, setDocument] = useState<PageLayoutDocument | null>(null);
  const [savedDocument, setSavedDocument] = useState<PageLayoutDocument | null>(null);
  const [undoDocument, setUndoDocument] = useState<PageLayoutDocument | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [settingsWidgetId, setSettingsWidgetId] = useState<string | null>(null);
  const [settingsCloseRequestKey, setSettingsCloseRequestKey] = useState(0);
  const [refreshTokens, setRefreshTokens] = useState<Record<string, number>>({});
  const [activeBreakpoint, setActiveBreakpoint] = useState<LayoutBreakpoint>(() =>
    resolveBreakpoint(typeof window === "undefined" ? 1200 : window.innerWidth),
  );
  const settingsExitResolverRef = useRef<((allowed: boolean) => void) | null>(null);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const layoutRevisionRef = useRef(0);
  const persistedRevisionRef = useRef(0);
  const documentRef = useRef<PageLayoutDocument | null>(null);
  const savedDocumentRef = useRef<PageLayoutDocument | null>(null);
  const interactionBaselineRef = useRef<PageLayoutDocument | null>(null);
  const acceptLayoutEventsRef = useRef(false);
  const pendingPersistRef = useRef(false);
  const activeBreakpointRef = useRef<LayoutBreakpoint>(activeBreakpoint);
  const pageIdRef = useRef(pageId);

  useEffect(() => {
    documentRef.current = document;
  }, [document]);

  useEffect(() => {
    savedDocumentRef.current = savedDocument;
  }, [savedDocument]);

  useEffect(() => {
    activeBreakpointRef.current = activeBreakpoint;
  }, [activeBreakpoint]);

  useEffect(() => {
    pageIdRef.current = pageId;
  }, [pageId]);

  const clearSaveTimer = useCallback(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
  }, []);

  const persistLayout = useCallback(
    async (next: PageLayoutDocument, revision: number) => {
      setSaveStatus("saving");
      setSaveError(null);
      layoutDebug("persist:start", {
        pageId: pageIdRef.current,
        breakpoint: activeBreakpointRef.current,
        layoutRevision: revision,
        mutationRevision: revision,
      });
      try {
        const response = await api.savePageLayout(pageId, next);
        if (revision < layoutRevisionRef.current) {
          // Server accepted an older revision; keep it as the last known saved
          // baseline only when nothing newer has been acknowledged yet.
          const saved = clonePageLayout(response.layout);
          if (revision >= persistedRevisionRef.current) {
            persistedRevisionRef.current = revision;
            setSavedDocument(saved);
            savedDocumentRef.current = saved;
          }
          layoutDebug("persist:ignored-stale-success", {
            pageId: pageIdRef.current,
            mutationRevision: revision,
            layoutRevision: layoutRevisionRef.current,
          });
          return;
        }
        const saved = clonePageLayout(response.layout);
        persistedRevisionRef.current = revision;
        setSavedDocument(saved);
        savedDocumentRef.current = saved;
        // Keep local authoritative if the user already moved again; otherwise
        // normalize to the confirmed server document without a visual jump.
        if (documentRef.current && layoutsEqual(documentRef.current, next)) {
          setDocument(saved);
          documentRef.current = saved;
        }
        if (documentRef.current && layoutsEqual(documentRef.current, saved)) {
          setSaveStatus("saved");
        } else {
          setSaveStatus("dirty");
        }
        layoutDebug("persist:success", {
          pageId: pageIdRef.current,
          mutationRevision: revision,
          layoutRevision: layoutRevisionRef.current,
        });
      } catch (error) {
        if (revision < layoutRevisionRef.current) {
          layoutDebug("persist:ignored-stale-failure", {
            pageId: pageIdRef.current,
            mutationRevision: revision,
            layoutRevision: layoutRevisionRef.current,
          });
          return;
        }
        const rollback = savedDocumentRef.current
          ? clonePageLayout(savedDocumentRef.current)
          : createDefaultPageLayout();
        setDocument(rollback);
        documentRef.current = rollback;
        setUndoDocument(null);
        setSaveStatus("error");
        setSaveError(error instanceof Error ? error.message : "Could not save layout");
        layoutDebug("persist:rollback", {
          pageId: pageIdRef.current,
          mutationRevision: revision,
        });
      }
    },
    [api, pageId],
  );

  const scheduleSave = useCallback(
    (next: PageLayoutDocument, revision: number) => {
      clearSaveTimer();
      setSaveStatus("dirty");
      saveTimerRef.current = setTimeout(() => {
        void persistLayout(next, revision);
      }, LAYOUT_SAVE_DEBOUNCE_MS);
    },
    [clearSaveTimer, persistLayout],
  );

  const commitDocument = useCallback(
    (next: PageLayoutDocument, options?: { recordUndoFrom?: PageLayoutDocument | null }) => {
      const parsed = pageLayoutDocumentSchema.parse(next);
      const revision = ++layoutRevisionRef.current;
      if (options?.recordUndoFrom && !layoutsEqual(parsed, options.recordUndoFrom)) {
        setUndoDocument(clonePageLayout(options.recordUndoFrom));
      }
      setDocument(parsed);
      documentRef.current = parsed;
      layoutDebug("commit", {
        pageId: pageIdRef.current,
        breakpoint: activeBreakpointRef.current,
        layoutRevision: revision,
        localAfter: parsed.layouts[activeBreakpointRef.current],
      });
      if (savedDocumentRef.current && layoutsEqual(parsed, savedDocumentRef.current)) {
        setSaveStatus("saved");
        clearSaveTimer();
        return;
      }
      scheduleSave(parsed, revision);
    },
    [clearSaveTimer, scheduleSave],
  );

  useEffect(() => {
    let cancelled = false;
    acceptLayoutEventsRef.current = false;
    clearSaveTimer();
    layoutRevisionRef.current = 0;
    persistedRevisionRef.current = 0;
    setLoadState("loading");
    setLoadError(null);
    setSaveStatus("idle");
    setSaveError(null);
    setUndoDocument(null);
    setSelectedId(null);
    setDocument(null);
    setSavedDocument(null);

    void (async () => {
      try {
        const response = await api.getPageLayout(pageId);
        if (cancelled) {
          return;
        }
        const layout = clonePageLayout(response.layout);
        setDocument(layout);
        setSavedDocument(layout);
        documentRef.current = layout;
        savedDocumentRef.current = layout;
        setLoadState("ready");
        setSaveStatus(response.isDefault ? "idle" : "saved");
        layoutDebug("hydrate", {
          pageId,
          isDefault: response.isDefault,
          breakpoint: activeBreakpointRef.current,
        });
        // Ignore RGL mount normalization until the next frame.
        requestAnimationFrame(() => {
          if (!cancelled) {
            acceptLayoutEventsRef.current = true;
          }
        });
      } catch (error) {
        if (cancelled) {
          return;
        }
        setLoadState("error");
        setLoadError(error instanceof Error ? error.message : "Could not load layout");
      }
    })();

    return () => {
      cancelled = true;
      clearSaveTimer();
    };
  }, [api, clearSaveTimer, pageId]);

  useEffect(() => {
    if (loadState === "ready") {
      measureWidth();
    }
  }, [loadState, measureWidth]);

  const dirty = useMemo(() => {
    if (!document || !savedDocument) {
      return false;
    }
    return !layoutsEqual(document, savedDocument);
  }, [document, savedDocument]);

  const syncLayoutsFromGrid = useCallback(
    (
      all: ResponsiveLayouts<LayoutBreakpoint>,
      options?: { persist?: boolean; recordUndoFrom?: PageLayoutDocument | null },
    ) => {
      if (!documentRef.current || !acceptLayoutEventsRef.current) {
        return;
      }
      const nextLayouts = fromRglLayouts(all, documentRef.current.layouts);
      const next: PageLayoutDocument = {
        ...documentRef.current,
        layouts: nextLayouts,
      };
      if (layoutsEqual(next, documentRef.current)) {
        if (options?.persist) {
          const baseline = options.recordUndoFrom ?? interactionBaselineRef.current;
          interactionBaselineRef.current = null;
          commitDocument(next, { recordUndoFrom: baseline });
        }
        return;
      }
      setDocument(next);
      documentRef.current = next;
      if (options?.persist) {
        const baseline = options.recordUndoFrom ?? interactionBaselineRef.current;
        interactionBaselineRef.current = null;
        commitDocument(next, { recordUndoFrom: baseline });
      } else if (savedDocumentRef.current && !layoutsEqual(next, savedDocumentRef.current)) {
        setSaveStatus("dirty");
      }
    },
    [commitDocument],
  );

  const onLayoutChange = useCallback(
    (_current: Layout, all: ResponsiveLayouts<LayoutBreakpoint>) => {
      if (!editMode) {
        return;
      }
      if (pendingPersistRef.current) {
        pendingPersistRef.current = false;
        const baseline = interactionBaselineRef.current;
        interactionBaselineRef.current = null;
        syncLayoutsFromGrid(all, { persist: true, recordUndoFrom: baseline });
        return;
      }
      syncLayoutsFromGrid(all);
    },
    [editMode, syncLayoutsFromGrid],
  );

  const beginInteraction = useCallback(() => {
    if (documentRef.current) {
      interactionBaselineRef.current = clonePageLayout(documentRef.current);
      layoutDebug("interaction:begin", {
        pageId: pageIdRef.current,
        breakpoint: activeBreakpointRef.current,
        localBefore: documentRef.current.layouts[activeBreakpointRef.current],
      });
    }
  }, []);

  const finishInteraction = useCallback(
    (emitted: Layout) => {
      if (!editMode || !documentRef.current) {
        return;
      }
      const breakpoint = activeBreakpointRef.current;
      const baseline = interactionBaselineRef.current;
      const next = applyEmittedBreakpointLayout(documentRef.current, breakpoint, emitted);
      layoutDebug("interaction:finish", {
        pageId: pageIdRef.current,
        breakpoint,
        emitted,
        localBefore: baseline?.layouts[breakpoint],
        localAfter: next.layouts[breakpoint],
      });
      // Apply the emitted layout immediately so the controlled `layouts` prop cannot
      // snap the widget back before RGL's follow-up onLayoutChange runs.
      setDocument(next);
      documentRef.current = next;
      interactionBaselineRef.current = baseline;
      pendingPersistRef.current = true;
      // If onLayoutChange does not fire (no diff), still commit this exact layout.
      queueMicrotask(() => {
        if (!pendingPersistRef.current || !documentRef.current) {
          return;
        }
        pendingPersistRef.current = false;
        const undoFrom = interactionBaselineRef.current;
        interactionBaselineRef.current = null;
        commitDocument(documentRef.current, { recordUndoFrom: undoFrom });
      });
    },
    [commitDocument, editMode],
  );

  const undo = useCallback(() => {
    if (!undoDocument) {
      return;
    }
    const restored = clonePageLayout(undoDocument);
    setUndoDocument(null);
    commitDocument(restored);
  }, [commitDocument, undoDocument]);

  const reset = useCallback(async () => {
    clearSaveTimer();
    setSaveStatus("saving");
    setSaveError(null);
    try {
      const response = await api.resetPageLayout(pageId);
      const layout = clonePageLayout(response.layout);
      if (documentRef.current) {
        setUndoDocument(clonePageLayout(documentRef.current));
      }
      setDocument(layout);
      setSavedDocument(layout);
      documentRef.current = layout;
      savedDocumentRef.current = layout;
      setSaveStatus("saved");
    } catch (error) {
      setSaveStatus("error");
      setSaveError(error instanceof Error ? error.message : "Could not reset layout");
    }
  }, [api, clearSaveTimer, pageId]);

  const moveSelected = useCallback(
    (dx: number, dy: number) => {
      if (!editMode || !selectedId || !documentRef.current) {
        return;
      }
      const cols = LAYOUT_COLS[activeBreakpoint];
      const currentLayout = documentRef.current.layouts[activeBreakpoint];
      const nextLayout = moveLayoutItem(currentLayout, selectedId, dx, dy, cols);
      if (serializeBreakpoint(currentLayout) === serializeBreakpoint(nextLayout)) {
        return;
      }
      commitDocument(
        {
          ...documentRef.current,
          layouts: {
            ...documentRef.current.layouts,
            [activeBreakpoint]: nextLayout,
          },
        },
        { recordUndoFrom: documentRef.current },
      );
    },
    [activeBreakpoint, commitDocument, editMode, selectedId],
  );

  const settingsWidget = useMemo(() => {
    if (!document || !settingsWidgetId) {
      return null;
    }
    return document.widgets.find((widget) => widget.id === settingsWidgetId) ?? null;
  }, [document, settingsWidgetId]);

  useEffect(() => {
    if (!editMode || !pendingConfigureWidgetId) {
      return;
    }
    setSettingsWidgetId(pendingConfigureWidgetId);
    clearPendingConfigureWidgetId();
  }, [clearPendingConfigureWidgetId, editMode, pendingConfigureWidgetId]);

  useEffect(() => {
    return registerBeforeExit(() => {
      setLibraryOpen(false);
      setSelectedId(null);
      if (!settingsWidgetId) {
        return true;
      }
      return new Promise<boolean>((resolve) => {
        settingsExitResolverRef.current = resolve;
        setSettingsCloseRequestKey((key) => key + 1);
      });
    });
  }, [registerBeforeExit, settingsWidgetId]);

  useEffect(() => {
    if (editMode) {
      return;
    }
    setLibraryOpen(false);
    setSelectedId(null);
    if (settingsWidgetId !== null && settingsExitResolverRef.current === null) {
      setSettingsWidgetId(null);
    }
  }, [editMode, settingsWidgetId]);

  const addCatalogEntry = useCallback(
    (entry: WidgetCatalogEntry) => {
      if (!documentRef.current) {
        return;
      }
      const instanceId = newWidgetInstanceId();
      const instance = createInstanceFromCatalog(entry, instanceId);
      const next = addWidgetToLayout(documentRef.current, instance, entry.defaultLayout);
      commitDocument(next, { recordUndoFrom: documentRef.current });
      setSelectedId(instanceId);
      setLibraryOpen(false);
      if (shouldOpenSettingsAfterAdd(entry)) {
        setSettingsWidgetId(instanceId);
      }
    },
    [commitDocument],
  );

  const saveWidgetSettings = useCallback(
    (widget: PageWidget) => {
      if (!documentRef.current) {
        return;
      }
      const next = updateWidgetInLayout(documentRef.current, widget.id, () => widget);
      commitDocument(next, { recordUndoFrom: documentRef.current });
    },
    [commitDocument],
  );

  const duplicateWidget = useCallback(
    (widgetId: string) => {
      if (!documentRef.current) {
        return;
      }
      const newId = newWidgetInstanceId();
      const next = duplicateWidgetInLayout(documentRef.current, widgetId, newId);
      commitDocument(next, { recordUndoFrom: documentRef.current });
      setSelectedId(newId);
      setSettingsWidgetId(null);
    },
    [commitDocument],
  );

  const removeWidget = useCallback(
    (widgetId: string) => {
      if (!documentRef.current) {
        return;
      }
      const next = removeWidgetFromLayout(documentRef.current, widgetId);
      commitDocument(next, { recordUndoFrom: documentRef.current });
      if (selectedId === widgetId) {
        setSelectedId(null);
      }
      if (settingsWidgetId === widgetId) {
        setSettingsWidgetId(null);
      }
    },
    [commitDocument, selectedId, settingsWidgetId],
  );

  const toggleWidgetEnabled = useCallback(
    (widgetId: string) => {
      if (!documentRef.current) {
        return;
      }
      const next = updateWidgetInLayout(documentRef.current, widgetId, (widget) => ({
        ...widget,
        enabled: !widget.enabled,
      }));
      commitDocument(next, { recordUndoFrom: documentRef.current });
    },
    [commitDocument],
  );

  const resetConfig = useCallback(
    (widgetId: string) => {
      if (!documentRef.current) {
        return;
      }
      const next = updateWidgetInLayout(documentRef.current, widgetId, (widget) =>
        resetWidgetConfig(widget, catalogEntryForInstance(widget)),
      );
      commitDocument(next, { recordUndoFrom: documentRef.current });
    },
    [commitDocument],
  );

  const refreshWidget = useCallback(
    (widgetId: string) => {
      if (!documentRef.current) {
        return;
      }
      const next = updateWidgetInLayout(documentRef.current, widgetId, (widget) => ({
        ...widget,
        lastUpdatedAt: Date.now(),
      }));
      commitDocument(next, { recordUndoFrom: documentRef.current });
      setRefreshTokens((prev) => ({
        ...prev,
        [widgetId]: (prev[widgetId] ?? 0) + 1,
      }));
    },
    [commitDocument],
  );

  if (loadState === "error") {
    return (
      <div className="dash-layout dash-layout--error" role="alert">
        <p>{loadError ?? "Layout unavailable"}</p>
      </div>
    );
  }

  const rowHeight = activeBreakpoint === "sm" ? LAYOUT_ROW_HEIGHT - 16 : LAYOUT_ROW_HEIGHT;
  const margins = {
    lg: LAYOUT_MARGIN,
    md: LAYOUT_MARGIN,
    sm: [12, 12] as [number, number],
  };
  const showGrid = loadState === "ready" && document !== null && mounted;
  const isEmpty = document !== null && document.widgets.length === 0;

  return (
    <div
      className="dash-layout"
      data-edit={editMode ? "true" : "false"}
      data-dirty={dirty ? "true" : "false"}
      data-breakpoint={activeBreakpoint}
    >
      {editMode && document ? (
        <div className="dash-layout__toolbar" role="toolbar" aria-label="Layout editing">
          <output
            className={cx(
              "dash-layout__status",
              dirty && "dash-layout__status--dirty",
              saveStatus === "error" && "dash-layout__status--error",
              saveStatus === "saved" && !dirty && "dash-layout__status--saved",
            )}
            aria-live="polite"
          >
            {saveError ?? statusLabel(saveStatus, dirty)}
          </output>
          <div className="dash-layout__toolbar-actions">
            <Button type="button" size="sm" onClick={() => setLibraryOpen(true)}>
              Add widget
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={!undoDocument}
              onClick={undo}
            >
              Undo
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => void reset()}>
              Reset layout
            </Button>
          </div>
        </div>
      ) : null}

      <div
        ref={containerRef}
        className={cx("dash-layout__viewport", !showGrid && "dash-layout__viewport--measuring")}
        aria-busy={!showGrid}
      >
        {!showGrid || !document ? (
          <div className="dash-layout__skeleton-grid" aria-hidden={loadState === "ready"}>
            <Skeleton height="10rem" />
            <Skeleton height="10rem" />
            <Skeleton height="10rem" />
            <Skeleton height="12rem" />
          </div>
        ) : isEmpty ? (
          <EmptyState
            title="No widgets yet"
            description={
              editMode
                ? "Add a widget from the catalog to start building this page."
                : "Enter edit mode to add widgets to this page."
            }
            action={
              editMode ? (
                <Button type="button" onClick={() => setLibraryOpen(true)}>
                  Add widget
                </Button>
              ) : (
                <Button type="button" variant="secondary" onClick={() => enterEditMode()}>
                  Enter edit mode
                </Button>
              )
            }
          />
        ) : (
          <Responsive
            className="dash-layout__grid"
            width={width}
            layouts={toRglLayouts(document.layouts)}
            breakpoints={LAYOUT_BREAKPOINTS}
            cols={LAYOUT_COLS}
            rowHeight={rowHeight}
            margin={margins}
            containerPadding={[0, 0]}
            dragConfig={{
              enabled: editMode,
              handle: DASHORA_WIDGET_DRAG_HANDLE_SELECTOR,
              cancel: DASHORA_WIDGET_DRAG_CANCEL_SELECTOR,
            }}
            resizeConfig={{
              enabled: editMode,
              handles: ["se", "e", "s"],
            }}
            compactor={verticalCompactor}
            onBreakpointChange={(breakpoint) => {
              setActiveBreakpoint(breakpoint as LayoutBreakpoint);
            }}
            onLayoutChange={onLayoutChange}
            onDragStart={() => beginInteraction()}
            onDragStop={(layout) => finishInteraction(layout)}
            onResizeStart={() => beginInteraction()}
            onResizeStop={(layout) => finishInteraction(layout)}
          >
            {document.widgets.map((widget) => (
              <div key={widget.id} className="dash-layout__item">
                <WidgetInstanceCard
                  widget={widget}
                  editMode={editMode}
                  selected={selectedId === widget.id}
                  onSelect={() => setSelectedId(widget.id)}
                  onKeyMove={moveSelected}
                  onOpenSettings={() => setSettingsWidgetId(widget.id)}
                  onEnterEditToConfigure={() => enterEditMode({ configureWidgetId: widget.id })}
                  onDuplicate={() => duplicateWidget(widget.id)}
                  onToggleEnabled={() => toggleWidgetEnabled(widget.id)}
                  onRemove={() => removeWidget(widget.id)}
                  onResetConfig={() => resetConfig(widget.id)}
                  onRefresh={() => refreshWidget(widget.id)}
                  refreshToken={refreshTokens[widget.id] ?? 0}
                />
              </div>
            ))}
          </Responsive>
        )}
      </div>

      {editMode && document && !isEmpty ? (
        <p className="dash-layout__a11y-hint">
          Select a widget, then use arrow keys to move it. Hold Shift for larger steps. Drag the
          handle to reposition; resize from the edges.
        </p>
      ) : null}

      <WidgetLibraryDrawer
        open={editMode && libraryOpen}
        onOpenChange={(open) => {
          if (editMode) {
            setLibraryOpen(open);
          }
        }}
        onAdd={addCatalogEntry}
      />

      <WidgetSettingsDrawer
        open={editMode && settingsWidgetId !== null}
        widget={settingsWidget}
        closeRequestKey={settingsCloseRequestKey}
        onCloseRequestSettled={(closed) => {
          const resolve = settingsExitResolverRef.current;
          settingsExitResolverRef.current = null;
          if (closed) {
            setSettingsWidgetId(null);
          }
          resolve?.(closed);
        }}
        onOpenChange={(open) => {
          if (!open) {
            setSettingsWidgetId(null);
          }
        }}
        onSave={saveWidgetSettings}
        onDuplicate={duplicateWidget}
        onRemove={removeWidget}
        onResetConfig={resetConfig}
      />
    </div>
  );
}
