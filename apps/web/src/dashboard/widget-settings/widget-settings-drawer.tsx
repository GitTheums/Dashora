import type {
  PageWidget,
  PlaceholderTone,
  PlaceholderWidget,
  TypedWidgetInstance,
} from "@dashora/shared";
import { Button, Dialog, DialogBody, Drawer, Input, Select, Skeleton, Switch } from "@dashora/ui";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import {
  type WidgetCatalogEntry,
  catalogEntryForInstance,
  getCatalogEntry,
} from "../widget-library/catalog.js";
import { getWidgetDefinition, getWidgetSettings } from "../widgets/registry.js";

export type WidgetSettingsDrawerProps = {
  open: boolean;
  widget: PageWidget | null;
  onOpenChange: (open: boolean) => void;
  onSave: (widget: PageWidget) => void;
  onDuplicate: (widgetId: string) => void;
  onRemove: (widgetId: string) => void;
  onResetConfig: (widgetId: string) => void;
  /**
   * Bump to request a close (e.g. leaving Edit mode). When dirty, shows the
   * discard dialog; calls `onCloseRequestSettled` with whether the drawer closed.
   */
  closeRequestKey?: number;
  onCloseRequestSettled?: (closed: boolean) => void;
};

type FieldErrors = {
  title?: string;
  refreshIntervalSeconds?: string;
  description?: string;
  config?: string;
};

function clearFieldError(prev: FieldErrors, key: keyof FieldErrors): FieldErrors {
  const next = { ...prev };
  delete next[key];
  return next;
}

const titleSchema = z.string().trim().min(1, "Title is required").max(80, "Title is too long");
const descriptionSchema = z.string().trim().max(240, "Description is too long").optional();
const refreshSchema = z
  .number({ invalid_type_error: "Enter a whole number of seconds" })
  .int("Enter a whole number of seconds")
  .positive("Refresh interval must be positive")
  .max(86_400, "Refresh interval cannot exceed 24 hours")
  .nullable();

const TONE_OPTIONS = [
  { value: "default", label: "Default" },
  { value: "accent", label: "Accent" },
  { value: "muted", label: "Muted" },
];

function snapshot(widget: PageWidget): string {
  return JSON.stringify(widget);
}

export function WidgetSettingsDrawer({
  open,
  widget,
  onOpenChange,
  onSave,
  onDuplicate,
  onRemove,
  onResetConfig,
  closeRequestKey = 0,
  onCloseRequestSettled,
}: WidgetSettingsDrawerProps) {
  const [draft, setDraft] = useState<PageWidget | null>(widget);
  const [baseline, setBaseline] = useState<string>("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [discardOpen, setDiscardOpen] = useState(false);
  const [exitAfterDiscard, setExitAfterDiscard] = useState(false);
  const lastCloseRequestKeyRef = useRef(closeRequestKey);

  const widgetId = widget?.id ?? null;
  const widgetSnapshot = widget ? snapshot(widget) : "";

  useEffect(() => {
    if (!open || !widgetId || !widgetSnapshot) {
      return;
    }
    const clone = JSON.parse(widgetSnapshot) as PageWidget;
    setDraft(clone);
    setBaseline(widgetSnapshot);
    setErrors({});
    setDiscardOpen(false);
    setExitAfterDiscard(false);
  }, [open, widgetId, widgetSnapshot]);

  const dirty = useMemo(() => {
    if (!draft) {
      return false;
    }
    return snapshot(draft) !== baseline;
  }, [baseline, draft]);

  const catalog: WidgetCatalogEntry | undefined = draft
    ? (catalogEntryForInstance(draft) ??
      (draft.kind === "widget" ? getCatalogEntry(draft.type) : undefined))
    : undefined;

  const definition = draft?.kind === "widget" ? getWidgetDefinition(draft.type) : undefined;
  const SettingsComponent = draft?.kind === "widget" ? getWidgetSettings(draft.type) : undefined;

  const minRefresh =
    definition?.refresh.minManualIntervalSeconds ??
    catalog?.metadata?.refresh.minManualIntervalSeconds ??
    3;
  const defaultRefresh =
    definition?.refresh.defaultIntervalSeconds ??
    catalog?.metadata?.refresh.defaultIntervalSeconds ??
    60;

  const finishClose = (closed: boolean) => {
    if (closed) {
      onOpenChange(false);
    }
    onCloseRequestSettled?.(closed);
  };

  const requestClose = (fromExitRequest = false) => {
    if (dirty) {
      setExitAfterDiscard(fromExitRequest);
      setDiscardOpen(true);
      return;
    }
    finishClose(true);
  };

  useEffect(() => {
    if (!open || closeRequestKey === lastCloseRequestKeyRef.current) {
      return;
    }
    lastCloseRequestKeyRef.current = closeRequestKey;
    if (dirty) {
      setExitAfterDiscard(true);
      setDiscardOpen(true);
      return;
    }
    onOpenChange(false);
    onCloseRequestSettled?.(true);
  }, [closeRequestKey, dirty, onCloseRequestSettled, onOpenChange, open]);

  const validate = (next: PageWidget): FieldErrors => {
    const nextErrors: FieldErrors = {};
    const titleResult = titleSchema.safeParse(next.title);
    if (!titleResult.success) {
      nextErrors.title = titleResult.error.issues[0]?.message ?? "Invalid title";
    }

    if (next.kind === "placeholder") {
      const descriptionResult = descriptionSchema.safeParse(next.description ?? "");
      if (!descriptionResult.success) {
        nextErrors.description =
          descriptionResult.error.issues[0]?.message ?? "Invalid description";
      }
    }

    if (next.refreshIntervalSeconds !== undefined && next.refreshIntervalSeconds !== null) {
      const refreshResult = refreshSchema.safeParse(next.refreshIntervalSeconds);
      if (!refreshResult.success) {
        nextErrors.refreshIntervalSeconds =
          refreshResult.error.issues[0]?.message ?? "Invalid refresh interval";
      } else if (next.refreshIntervalSeconds < minRefresh) {
        nextErrors.refreshIntervalSeconds = `Minimum interval is ${minRefresh} seconds`;
      }
    }

    if (next.kind === "widget" && definition) {
      const configResult = definition.configSchema.safeParse(next.config);
      if (!configResult.success) {
        nextErrors.config = configResult.error.issues[0]?.message ?? "Invalid widget configuration";
      }
    }

    return nextErrors;
  };

  const save = () => {
    if (!draft) {
      return;
    }
    const nextErrors = validate(draft);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }
    let toSave = draft;
    if (draft.kind === "widget" && definition) {
      toSave = {
        ...draft,
        config: definition.configSchema.parse(draft.config) as Record<string, unknown>,
      };
    }
    onSave(toSave);
    setBaseline(snapshot(toSave));
    onOpenChange(false);
  };

  if (!draft) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange} title="Widget settings">
        <p>Select a widget to configure.</p>
      </Drawer>
    );
  }

  const supportsTitle = catalog?.capabilities.supportsTitleOverride ?? true;
  const supportsDisable = catalog?.capabilities.supportsDisable ?? true;
  const refreshValue =
    draft.refreshIntervalSeconds === null || draft.refreshIntervalSeconds === undefined
      ? ""
      : String(draft.refreshIntervalSeconds);

  return (
    <>
      <Drawer
        open={open}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            requestClose();
            return;
          }
          onOpenChange(true);
        }}
        title="Widget settings"
        description={
          dirty
            ? "You have unsaved changes."
            : catalog
              ? `Configure ${catalog.name}.`
              : "Configure this widget instance."
        }
        footer={
          <div className="widget-settings__footer">
            <div className="widget-settings__footer-secondary">
              <Button type="button" size="sm" variant="ghost" onClick={() => onDuplicate(draft.id)}>
                Duplicate
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => onResetConfig(draft.id)}
              >
                Reset config
              </Button>
              <Button type="button" size="sm" variant="danger" onClick={() => onRemove(draft.id)}>
                Remove
              </Button>
            </div>
            <div className="widget-settings__footer-primary">
              <Button type="button" variant="secondary" onClick={() => requestClose()}>
                Cancel
              </Button>
              <Button type="button" onClick={save} disabled={!dirty}>
                Save
              </Button>
            </div>
          </div>
        }
      >
        <div className="widget-settings">
          {supportsTitle ? (
            <Input
              label="Title"
              value={draft.title}
              error={errors.title}
              onChange={(event) => {
                setDraft({ ...draft, title: event.target.value });
                setErrors((prev) => clearFieldError(prev, "title"));
              }}
            />
          ) : null}

          <Input
            label="Refresh interval (seconds)"
            type="number"
            min={minRefresh}
            max={86_400}
            placeholder={`Default ${defaultRefresh}`}
            value={refreshValue}
            hint={`Leave blank to use the default (${defaultRefresh}s). Minimum ${minRefresh}s.`}
            error={errors.refreshIntervalSeconds}
            onChange={(event) => {
              const raw = event.target.value.trim();
              setDraft({
                ...draft,
                refreshIntervalSeconds: raw === "" ? null : Number(raw),
              });
              setErrors((prev) => clearFieldError(prev, "refreshIntervalSeconds"));
            }}
          />

          {supportsDisable ? (
            <Switch
              label="Enabled"
              checked={draft.enabled}
              onChange={(event) => setDraft({ ...draft, enabled: event.target.checked })}
            />
          ) : null}

          {draft.kind === "placeholder" ? (
            <PlaceholderFields
              widget={draft}
              {...(errors.description ? { error: errors.description } : {})}
              onChange={(next) => {
                setDraft(next);
                setErrors((prev) => clearFieldError(prev, "description"));
              }}
            />
          ) : null}

          {draft.kind === "widget" && SettingsComponent ? (
            <div className="widget-settings__typed">
              <h3 className="widget-settings__section-title">Widget configuration</h3>
              {errors.config ? (
                <p className="ds-hint ds-hint--error" role="alert">
                  {errors.config}
                </p>
              ) : null}
              <Suspense fallback={<Skeleton height="10rem" />}>
                <SettingsComponent
                  instanceId={draft.id}
                  config={draft.config}
                  onChange={(config: unknown) => {
                    setDraft({
                      ...draft,
                      config: config as Record<string, unknown>,
                    });
                    setErrors((prev) => clearFieldError(prev, "config"));
                  }}
                />
              </Suspense>
            </div>
          ) : null}
        </div>
      </Drawer>

      <Dialog
        open={discardOpen}
        onOpenChange={(nextOpen) => {
          setDiscardOpen(nextOpen);
          if (!nextOpen && exitAfterDiscard) {
            setExitAfterDiscard(false);
            onCloseRequestSettled?.(false);
          }
        }}
        title="Discard unsaved changes?"
        description="Your edits to this widget will be lost."
        footer={
          <>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setDiscardOpen(false);
                if (exitAfterDiscard) {
                  setExitAfterDiscard(false);
                  onCloseRequestSettled?.(false);
                }
              }}
            >
              Keep editing
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={() => {
                setDiscardOpen(false);
                setExitAfterDiscard(false);
                finishClose(true);
              }}
            >
              Discard
            </Button>
          </>
        }
      >
        <DialogBody>
          <p>Close settings without saving?</p>
        </DialogBody>
      </Dialog>
    </>
  );
}

function PlaceholderFields({
  widget,
  error,
  onChange,
}: {
  widget: PlaceholderWidget;
  error?: string;
  onChange: (widget: PlaceholderWidget) => void;
}) {
  return (
    <>
      <Input
        label="Description"
        value={widget.description ?? ""}
        error={error}
        onChange={(event) =>
          onChange({
            ...widget,
            description: event.target.value,
          })
        }
      />
      <Select
        label="Tone"
        options={TONE_OPTIONS}
        value={widget.tone}
        onChange={(event) =>
          onChange({
            ...widget,
            tone: event.target.value as PlaceholderTone,
          })
        }
      />
    </>
  );
}

export function resetWidgetConfig(
  widget: PageWidget,
  catalog: WidgetCatalogEntry | undefined,
): PageWidget {
  if (widget.kind === "placeholder") {
    const defaults = catalog?.placeholderDefaults;
    return {
      ...widget,
      title: defaults?.title ?? widget.title,
      description: defaults?.description ?? widget.description,
      tone: defaults?.tone ?? widget.tone,
      refreshIntervalSeconds: null,
      enabled: true,
    };
  }

  const definition = getWidgetDefinition(widget.type);
  const typed: TypedWidgetInstance = {
    ...widget,
    config: structuredClone(
      (catalog?.defaultConfig as Record<string, unknown> | undefined) ??
        (definition?.defaultConfig as Record<string, unknown> | undefined) ??
        {},
    ),
    schemaVersion: definition?.schemaVersion ?? widget.schemaVersion,
    refreshIntervalSeconds: null,
    enabled: true,
    title: catalog?.name ?? widget.title,
  };
  return typed;
}
