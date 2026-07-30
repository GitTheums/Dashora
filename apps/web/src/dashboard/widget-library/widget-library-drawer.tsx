import {
  Badge,
  Button,
  Drawer,
  EmptyState,
  Input,
  Tabs,
  TabsList,
  TabsTrigger,
  cx,
} from "@dashora/ui";
import {
  type KeyboardEvent as ReactKeyboardEvent,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  CATALOG_CATEGORY_FILTERS,
  type WidgetCatalogEntry,
  filterCatalog,
  formatDefaultSize,
} from "./catalog.js";

export type WidgetLibraryDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (entry: WidgetCatalogEntry) => void;
};

export function WidgetLibraryDrawer({ open, onOpenChange, onAdd }: WidgetLibraryDrawerProps) {
  const searchId = useId();
  const listId = useId();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<(typeof CATALOG_CATEGORY_FILTERS)[number]["id"]>("all");
  const [activeId, setActiveId] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const entries = useMemo(() => filterCatalog(query, category), [category, query]);

  useEffect(() => {
    if (!open) {
      return;
    }
    setQuery("");
    setCategory("all");
    const first = filterCatalog("", "all")[0];
    setActiveId(first?.id ?? null);
    const timer = window.setTimeout(() => {
      document.getElementById(searchId)?.focus();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [open, searchId]);

  useEffect(() => {
    if (entries.length === 0) {
      setActiveId(null);
      return;
    }
    if (!activeId || !entries.some((entry) => entry.id === activeId)) {
      setActiveId(entries[0]?.id ?? null);
    }
  }, [activeId, entries]);

  const active = entries.find((entry) => entry.id === activeId) ?? null;

  const moveActive = (delta: number) => {
    if (entries.length === 0) {
      return;
    }
    const index = Math.max(
      0,
      entries.findIndex((entry) => entry.id === activeId),
    );
    const next = entries[(index + delta + entries.length) % entries.length];
    if (next) {
      setActiveId(next.id);
      const option = listRef.current?.querySelector<HTMLElement>(
        `[data-catalog-id="${CSS.escape(next.id)}"]`,
      );
      option?.focus();
      option?.scrollIntoView({ block: "nearest" });
    }
  };

  const onListKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        moveActive(1);
        break;
      case "ArrowUp":
        event.preventDefault();
        moveActive(-1);
        break;
      case "Home":
        event.preventDefault();
        if (entries[0]) {
          setActiveId(entries[0].id);
        }
        break;
      case "End": {
        event.preventDefault();
        const last = entries[entries.length - 1];
        if (last) {
          setActiveId(last.id);
        }
        break;
      }
      case "Enter":
        event.preventDefault();
        if (active) {
          onAdd(active);
        }
        break;
      default:
        break;
    }
  };

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      title="Add widget"
      description="Browse the catalog, preview a widget, then add it to the active page."
      side="right"
      footer={
        active ? (
          <div className="widget-library__footer">
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={() => onAdd(active)}>
              Add to page
            </Button>
          </div>
        ) : null
      }
    >
      <div className="widget-library">
        <Input
          id={searchId}
          label="Search widgets"
          placeholder="Search by name or category"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              const first = listRef.current?.querySelector<HTMLElement>("[data-catalog-id]");
              first?.focus();
            }
          }}
        />

        <Tabs
          defaultValue="all"
          value={category}
          onValueChange={(value) =>
            setCategory(value as (typeof CATALOG_CATEGORY_FILTERS)[number]["id"])
          }
        >
          <TabsList aria-label="Widget categories">
            {CATALOG_CATEGORY_FILTERS.map((filter) => (
              <TabsTrigger key={filter.id} value={filter.id}>
                {filter.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="widget-library__panes">
          <div
            ref={listRef}
            id={listId}
            className="widget-library__list"
            aria-label="Widget catalog"
            tabIndex={-1}
            onKeyDown={onListKeyDown}
          >
            {entries.length === 0 ? (
              <EmptyState
                title="No widgets match"
                description="Try another search term or category."
              />
            ) : (
              entries.map((entry) => {
                const selected = entry.id === activeId;
                return (
                  <button
                    key={entry.id}
                    id={`${listId}-${entry.id}`}
                    type="button"
                    aria-pressed={selected}
                    data-catalog-id={entry.id}
                    className={cx(
                      "widget-library__option",
                      selected && "widget-library__option--selected",
                    )}
                    onClick={() => setActiveId(entry.id)}
                    onDoubleClick={() => onAdd(entry)}
                    onFocus={() => setActiveId(entry.id)}
                  >
                    <span className="widget-library__option-title">{entry.name}</span>
                    <span className="widget-library__option-meta">
                      {entry.category}
                      {entry.capabilities.requiresIntegration ? " · Integration" : ""}
                    </span>
                  </button>
                );
              })
            )}
          </div>

          <div className="widget-library__preview" aria-live="polite">
            {active ? (
              <CatalogPreview entry={active} />
            ) : (
              <EmptyState title="Select a widget" description="Choose an entry to preview it." />
            )}
          </div>
        </div>
      </div>
    </Drawer>
  );
}

function CatalogPreview({ entry }: { entry: WidgetCatalogEntry }) {
  return (
    <div className="widget-library__preview-card">
      <div className="widget-library__preview-header">
        <h3 className="widget-library__preview-title">{entry.name}</h3>
        <div className="widget-library__preview-badges">
          <Badge tone="neutral">{entry.category}</Badge>
          {entry.capabilities.requiresIntegration ? (
            <Badge tone="warning">Requires integration</Badge>
          ) : null}
          {entry.kind === "placeholder" ? <Badge tone="secondary">Placeholder</Badge> : null}
        </div>
      </div>
      <p className="widget-library__preview-description">{entry.description}</p>
      <dl className="widget-library__preview-meta">
        <div>
          <dt>Default size</dt>
          <dd>
            <span className="widget-library__size-preview" aria-hidden="true">
              <span
                className="widget-library__size-block"
                style={{
                  width: `${Math.max(18, entry.defaultLayout.colSpan * 8)}px`,
                  height: `${Math.max(14, entry.defaultLayout.rowSpan * 10)}px`,
                }}
              />
            </span>
            <span>{formatDefaultSize(entry.defaultLayout)} grid units</span>
          </dd>
        </div>
        <div>
          <dt>Refresh</dt>
          <dd>
            {entry.capabilities.supportsManualRefresh
              ? "Manual refresh supported"
              : "No manual refresh"}
          </dd>
        </div>
      </dl>
      <div className="widget-library__preview-shell" aria-hidden="true">
        <p className="widget-library__preview-shell-title">{entry.name}</p>
        <p className="widget-library__preview-shell-body">{entry.previewLabel}</p>
      </div>
    </div>
  );
}
