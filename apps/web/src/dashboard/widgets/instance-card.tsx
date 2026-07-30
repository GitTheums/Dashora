import type { PageWidget, PlaceholderWidget, TypedWidgetInstance } from "@dashora/shared";
import {
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  EmptyState,
  IconButton,
  cx,
} from "@dashora/ui";
import type { WidgetState } from "@dashora/widget-sdk";
import { type KeyboardEvent as ReactKeyboardEvent, useEffect, useMemo, useState } from "react";
import { MoreIcon, RefreshIcon } from "../icons.js";
import { type WidgetCatalogEntry, catalogEntryForInstance } from "../widget-library/catalog.js";
import { getWidgetDefinition, getWidgetRenderer } from "./registry.js";
import { resolveTypedWidgetPayload } from "./resolve-payload.js";
import { WidgetDragHandle } from "./widget-drag-handle.js";

function formatLastUpdated(value: number | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  try {
    return new Intl.DateTimeFormat(undefined, {
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
    }).format(new Date(value));
  } catch {
    return null;
  }
}

function needsConfiguration(
  widget: PageWidget,
  catalog: WidgetCatalogEntry | undefined,
  runtimeState?: WidgetState,
): boolean {
  if (!widget.enabled) {
    return false;
  }
  if (runtimeState === "configuration-required") {
    return true;
  }
  if (catalog?.capabilities.requiresIntegration) {
    return true;
  }
  if (widget.kind === "widget") {
    const config = widget.config as { forceState?: WidgetState };
    return config.forceState === "configuration-required";
  }
  return false;
}

export type WidgetInstanceCardProps = {
  widget: PageWidget;
  editMode: boolean;
  selected: boolean;
  onSelect: () => void;
  onKeyMove: (dx: number, dy: number) => void;
  onOpenSettings: () => void;
  onEnterEditToConfigure: () => void;
  onDuplicate: () => void;
  onToggleEnabled: () => void;
  onRemove: () => void;
  onResetConfig: () => void;
  onRefresh: () => void;
  refreshToken: number;
};

export function WidgetInstanceCard({
  widget,
  editMode,
  selected,
  onSelect,
  onKeyMove,
  onOpenSettings,
  onEnterEditToConfigure,
  onDuplicate,
  onToggleEnabled,
  onRemove,
  onResetConfig,
  onRefresh,
  refreshToken,
}: WidgetInstanceCardProps) {
  const catalog = catalogEntryForInstance(widget);
  const supportsRefresh = catalog?.capabilities.supportsManualRefresh ?? true;
  const lastUpdated = formatLastUpdated(widget.lastUpdatedAt ?? null);
  const configurationRequired = needsConfiguration(widget, catalog);

  const onKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (!editMode) {
      return;
    }
    const step = event.shiftKey ? 2 : 1;
    switch (event.key) {
      case "ArrowLeft":
        event.preventDefault();
        onKeyMove(-step, 0);
        break;
      case "ArrowRight":
        event.preventDefault();
        onKeyMove(step, 0);
        break;
      case "ArrowUp":
        event.preventDefault();
        onKeyMove(0, -step);
        break;
      case "ArrowDown":
        event.preventDefault();
        onKeyMove(0, step);
        break;
      default:
        break;
    }
  };

  return (
    <article
      className={cx(
        "widget-instance",
        widget.kind === "placeholder" && `widget-instance--${widget.tone ?? "default"}`,
        !widget.enabled && "widget-instance--disabled",
        selected && editMode && "widget-instance--selected",
        editMode && "widget-instance--editable",
      )}
      data-widget-id={widget.id}
      data-edit-mode={editMode ? "true" : "false"}
      tabIndex={editMode ? 0 : undefined}
      aria-label={`${widget.title} widget`}
      aria-grabbed={editMode && selected ? true : undefined}
      onFocus={editMode ? onSelect : undefined}
      onClick={editMode ? onSelect : undefined}
      onKeyDown={onKeyDown}
    >
      {editMode ? <WidgetDragHandle title={widget.title} /> : null}

      <header className="widget-instance__header">
        <div className="widget-instance__heading">
          <h2 className="widget-instance__title">{widget.title}</h2>
          <div className="widget-instance__badges">
            {!widget.enabled ? <Badge tone="neutral">Disabled</Badge> : null}
            {configurationRequired ? <Badge tone="warning">Setup</Badge> : null}
          </div>
        </div>
        <div className="widget-instance__actions" data-grid-drag-cancel>
          {supportsRefresh ? (
            <IconButton
              label={`Refresh ${widget.title}`}
              size="sm"
              variant="ghost"
              disabled={!widget.enabled}
              onClick={(event) => {
                event.stopPropagation();
                onRefresh();
              }}
            >
              <RefreshIcon />
            </IconButton>
          ) : null}
          {editMode ? (
            <DropdownMenu>
              <DropdownMenuTrigger>
                <IconButton label={`${widget.title} actions`} size="sm" variant="ghost">
                  <MoreIcon />
                </IconButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onSelect={() => {
                    onOpenSettings();
                  }}
                >
                  Settings
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={onDuplicate}>Duplicate</DropdownMenuItem>
                <DropdownMenuItem onSelect={onToggleEnabled}>
                  {widget.enabled ? "Disable" : "Enable"}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={onResetConfig}>Reset config</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={onRemove}>Remove</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
      </header>

      <div className="widget-instance__body" data-grid-drag-cancel>
        {!widget.enabled ? (
          <EmptyState
            title="Widget disabled"
            description={
              editMode
                ? "Enable this widget from the actions menu or settings."
                : "This widget is turned off. Enter edit mode to enable it."
            }
          />
        ) : configurationRequired ? (
          <ConfigurationRequiredBody
            editMode={editMode}
            onConfigure={onOpenSettings}
            onEnterEdit={onEnterEditToConfigure}
          />
        ) : widget.kind === "placeholder" ? (
          <PlaceholderBody widget={widget} />
        ) : (
          <TypedWidgetBody
            widget={widget}
            refreshToken={refreshToken}
            editMode={editMode}
            onConfigure={onOpenSettings}
            onEnterEdit={onEnterEditToConfigure}
          />
        )}
      </div>

      <footer className="widget-instance__footer">
        <span>{lastUpdated ? `Updated ${lastUpdated}` : "Not updated yet"}</span>
      </footer>
    </article>
  );
}

function ConfigurationRequiredBody({
  editMode,
  onConfigure,
  onEnterEdit,
}: {
  editMode: boolean;
  onConfigure: () => void;
  onEnterEdit: () => void;
}) {
  if (editMode) {
    return (
      <EmptyState
        title="Configuration required"
        description="Finish setup in widget settings to show live data."
        action={
          <Button type="button" size="sm" onClick={onConfigure}>
            Configure widget
          </Button>
        }
      />
    );
  }

  return (
    <EmptyState
      title="Configuration required"
      description="Edit the dashboard to configure this widget."
      action={
        <Button type="button" size="sm" variant="secondary" onClick={onEnterEdit}>
          Enter edit mode
        </Button>
      }
    />
  );
}

function PlaceholderBody({ widget }: { widget: PlaceholderWidget }) {
  return (
    <div className="widget-instance__placeholder-body">
      {widget.description ? (
        <p className="widget-instance__description">{widget.description}</p>
      ) : null}
      <p className="widget-instance__hint">Temporary placeholder</p>
    </div>
  );
}

function TypedWidgetBody({
  widget,
  refreshToken,
  editMode,
  onConfigure,
  onEnterEdit,
}: {
  widget: TypedWidgetInstance;
  refreshToken: number;
  editMode: boolean;
  onConfigure: () => void;
  onEnterEdit: () => void;
}) {
  const Renderer = getWidgetRenderer(widget.type);
  const definition = getWidgetDefinition(widget.type);
  const [state, setState] = useState<WidgetState>("loading");
  const [data, setData] = useState<unknown>();
  const [message, setMessage] = useState<string | undefined>();

  const parsedConfig = useMemo(() => {
    if (!definition) {
      return widget.config;
    }
    const result = definition.configSchema.safeParse(widget.config);
    return result.success ? result.data : widget.config;
  }, [definition, widget.config]);

  useEffect(() => {
    let cancelled = false;
    // Include refreshToken so chrome refresh bumps force a reload.
    const requestKey = `${widget.id}:${widget.type}:${refreshToken}`;
    setState("loading");
    setMessage(undefined);

    void (async () => {
      try {
        const payload = await resolveTypedWidgetPayload(
          widget.type,
          widget.id,
          parsedConfig,
          widget.enabled,
        );
        if (cancelled || requestKey.length === 0) {
          return;
        }
        setState(payload.state);
        setData(payload.data);
        setMessage(payload.message);
      } catch (error) {
        if (cancelled) {
          return;
        }
        setState("error");
        setData(undefined);
        setMessage(error instanceof Error ? error.message : "Could not load widget data.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [parsedConfig, refreshToken, widget.enabled, widget.id, widget.type]);

  if (!Renderer) {
    return (
      <EmptyState
        title="Unknown widget"
        description={`No renderer is registered for “${widget.type}”.`}
      />
    );
  }

  if (state === "configuration-required") {
    return (
      <ConfigurationRequiredBody
        editMode={editMode}
        onConfigure={onConfigure}
        onEnterEdit={onEnterEdit}
      />
    );
  }

  return (
    <Renderer
      instanceId={widget.id}
      title={widget.title}
      config={parsedConfig}
      state={state}
      {...(data !== undefined ? { data } : {})}
      {...(message !== undefined ? { message } : {})}
    />
  );
}
