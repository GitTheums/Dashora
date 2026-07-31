import {
  type CardRadius,
  DEFAULT_THEME_PREFERENCES,
  type DashboardThemeOverride,
  THEME_PRESET_META,
  type ThemeAccentId,
  type ThemeDensity,
  type ThemeMode,
  type ThemePreferences,
  type ThemePresetId,
  mergeThemePreferences,
} from "@dashora/shared";
import {
  Button,
  Dialog,
  DialogBody,
  Input,
  SectionHeader,
  Select,
  Stack,
  Switch,
  getAccentSwatch,
  useTheme,
} from "@dashora/ui";
import {
  type ChangeEvent,
  type MutableRefObject,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { navigate } from "../auth/routing.js";
import { readReturnToFromSearch } from "../settings/return-to.js";
import type { ThemeApi } from "./api.js";
import { ThemeApiError } from "./api.js";

export type AppearanceLeaveController = {
  requestLeave: (destination: string) => void;
};

const ACCENT_OPTIONS: Array<{ id: ThemeAccentId; label: string }> = [
  { id: "teal", label: "Teal" },
  { id: "sky", label: "Sky" },
  { id: "emerald", label: "Emerald" },
  { id: "amber", label: "Amber" },
  { id: "rose", label: "Rose" },
  { id: "violet", label: "Violet" },
  { id: "slate", label: "Slate" },
  { id: "custom", label: "Custom" },
];

export type AppearanceScope = "global" | "dashboard";

export type AppearancePageProps = {
  api: ThemeApi;
  dashboardOverride: DashboardThemeOverride | null;
  onDashboardOverrideChange: (override: DashboardThemeOverride | null) => void;
  envAppName: string;
  /** Called when the user requests leaving (Back). Parent may show shell back. */
  onRequestLeave?: (destination: string) => void;
  /** Expose dirty state for the settings shell. */
  onDirtyChange?: (dirty: boolean) => void;
  /** Lets the settings shell Back/brand actions respect unsaved changes. */
  leaveControllerRef?: MutableRefObject<AppearanceLeaveController | null>;
};

function draftFromPreferences(preferences: ThemePreferences): ThemePreferences {
  return structuredClone(preferences);
}

function preferencesSnapshot(value: ThemePreferences): string {
  return JSON.stringify({
    mode: value.mode,
    preset: value.preset,
    accent: value.accent,
    accentCustom: value.accentCustom ?? null,
    density: value.density,
    reducedTransparency: value.reducedTransparency,
    reducedMotion: value.reducedMotion,
    cardRadius: value.cardRadius,
    ambientBackground: value.ambientBackground,
    appName: value.appName ?? null,
    logoDataUrl: value.logoDataUrl ?? null,
  });
}

function overrideSnapshot(value: DashboardThemeOverride | null): string {
  return JSON.stringify(value ?? null);
}

function toOverridePayload(prefs: ThemePreferences): DashboardThemeOverride {
  return {
    mode: prefs.mode,
    preset: prefs.preset,
    accent: prefs.accent,
    accentCustom: prefs.accentCustom ?? null,
    density: prefs.density,
    reducedTransparency: prefs.reducedTransparency,
    reducedMotion: prefs.reducedMotion,
    cardRadius: prefs.cardRadius,
    ambientBackground: prefs.ambientBackground,
  };
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }
      reject(new Error("Could not read logo file"));
    };
    reader.onerror = () => {
      reject(new Error("Could not read logo file"));
    };
    reader.readAsDataURL(file);
  });
}

export function AppearancePage({
  api,
  dashboardOverride,
  onDashboardOverrideChange,
  envAppName,
  onRequestLeave,
  onDirtyChange,
  leaveControllerRef,
}: AppearancePageProps) {
  const { preferences, resolved, setPreferences, setPreview, clearPreview, setDashboardOverride } =
    useTheme();

  const [scope, setScope] = useState<AppearanceScope>(() =>
    dashboardOverride ? "dashboard" : "global",
  );
  const [globalDraft, setGlobalDraft] = useState<ThemePreferences>(() =>
    draftFromPreferences(preferences),
  );
  const [dashboardDraft, setDashboardDraft] = useState<ThemePreferences>(() =>
    draftFromPreferences(mergeThemePreferences(preferences, dashboardOverride)),
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [pendingLeaveTo, setPendingLeaveTo] = useState<string | null>(null);

  const returnTo = readReturnToFromSearch();

  useEffect(() => {
    const heading = document.getElementById("appearance-heading");
    heading?.focus();
  }, []);

  useEffect(() => {
    setGlobalDraft(draftFromPreferences(preferences));
  }, [preferences]);

  useEffect(() => {
    setDashboardDraft(draftFromPreferences(mergeThemePreferences(preferences, dashboardOverride)));
    if (dashboardOverride) {
      setScope((current) => current);
    }
  }, [dashboardOverride, preferences]);

  const activeDraft = scope === "global" ? globalDraft : dashboardDraft;

  const dirty = useMemo(() => {
    if (scope === "global") {
      return preferencesSnapshot(globalDraft) !== preferencesSnapshot(preferences);
    }
    const proposed = toOverridePayload(dashboardDraft);
    if (!dashboardOverride) {
      // Dirty only after the operator changes something from inherited globals.
      return overrideSnapshot(proposed) !== overrideSnapshot(toOverridePayload(preferences));
    }
    return overrideSnapshot(proposed) !== overrideSnapshot(dashboardOverride);
  }, [scope, globalDraft, preferences, dashboardDraft, dashboardOverride]);

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  const previewPatch = useMemo((): DashboardThemeOverride => {
    if (scope === "global") {
      return {
        mode: globalDraft.mode,
        preset: globalDraft.preset,
        accent: globalDraft.accent,
        accentCustom: globalDraft.accentCustom ?? null,
        density: globalDraft.density,
        reducedTransparency: globalDraft.reducedTransparency,
        reducedMotion: globalDraft.reducedMotion,
        cardRadius: globalDraft.cardRadius,
        ambientBackground: globalDraft.ambientBackground,
        appName: globalDraft.appName ?? null,
        logoDataUrl: globalDraft.logoDataUrl ?? null,
      };
    }
    return toOverridePayload(dashboardDraft);
  }, [scope, globalDraft, dashboardDraft]);

  useEffect(() => {
    setPreview(previewPatch);
    return () => {
      clearPreview();
    };
  }, [previewPatch, setPreview, clearPreview]);

  const patchActive = useCallback(
    (patch: Partial<ThemePreferences>) => {
      if (scope === "global") {
        setGlobalDraft((current) => ({ ...current, ...patch }));
      } else {
        setDashboardDraft((current) => ({ ...current, ...patch }));
      }
      setMessage(null);
      setError(null);
    },
    [scope],
  );

  const onLogoChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    try {
      const dataUrl = await fileToDataUrl(file);
      patchActive({ logoDataUrl: dataUrl });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to read logo");
    }
  };

  const discard = useCallback(() => {
    setGlobalDraft(draftFromPreferences(preferences));
    setDashboardDraft(draftFromPreferences(mergeThemePreferences(preferences, dashboardOverride)));
    clearPreview();
    setMessage("Changes discarded.");
    setError(null);
  }, [preferences, dashboardOverride, clearPreview]);

  const leaveTo = useCallback(
    (destination: string) => {
      if (dirty) {
        setPendingLeaveTo(destination);
        setLeaveOpen(true);
        return;
      }
      clearPreview();
      if (onRequestLeave) {
        onRequestLeave(destination);
        return;
      }
      navigate(destination);
    },
    [dirty, clearPreview, onRequestLeave],
  );

  useEffect(() => {
    if (!leaveControllerRef) {
      return;
    }
    leaveControllerRef.current = { requestLeave: leaveTo };
    return () => {
      leaveControllerRef.current = null;
    };
  }, [leaveControllerRef, leaveTo]);

  const save = async () => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      if (scope === "global") {
        const saved = await api.savePreferences(globalDraft);
        setPreferences(saved);
        setGlobalDraft(draftFromPreferences(saved));
        setMessage("Global appearance saved.");
      } else {
        const payload = toOverridePayload(dashboardDraft);
        const persistedOverride = await api.updateDashboardTheme(payload);
        onDashboardOverrideChange(persistedOverride);
        setDashboardOverride(persistedOverride);
        setMessage("Dashboard appearance saved.");
      }
    } catch (err) {
      setError(
        err instanceof ThemeApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Failed to save appearance",
      );
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      if (scope === "global") {
        const defaults = await api.resetPreferences();
        setPreferences(defaults);
        setGlobalDraft(draftFromPreferences(defaults));
        setMessage("Global appearance reset to defaults.");
      } else {
        const cleared = await api.updateDashboardTheme(null);
        onDashboardOverrideChange(cleared);
        setDashboardOverride(null);
        setDashboardDraft(draftFromPreferences(preferences));
        setMessage("Dashboard override removed. Using global appearance.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reset appearance");
    } finally {
      setBusy(false);
    }
  };

  const useGlobalAppearance = async () => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const cleared = await api.updateDashboardTheme(null);
      onDashboardOverrideChange(cleared);
      setDashboardOverride(null);
      setDashboardDraft(draftFromPreferences(preferences));
      setScope("global");
      setMessage("Now using global appearance for this dashboard.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to clear dashboard override");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="appearance-page">
      <header className="appearance-page__header">
        <div>
          <h1 className="appearance-page__title" tabIndex={-1} id="appearance-heading">
            Appearance
          </h1>
          <p className="appearance-page__lede">
            Customize how Dashora looks and feels. Changes preview live; save to persist the
            selected scope.
          </p>
        </div>
        <div className="appearance-page__actions">
          <Button type="button" variant="ghost" onClick={() => leaveTo(returnTo)}>
            Back to dashboard
          </Button>
          <Button type="button" variant="secondary" disabled={busy || !dirty} onClick={discard}>
            Discard
          </Button>
          <Button type="button" variant="secondary" disabled={busy} onClick={() => void reset()}>
            {scope === "global" ? "Reset to defaults" : "Reset dashboard override"}
          </Button>
          <Button type="button" disabled={busy || !dirty} onClick={() => void save()}>
            {busy ? "Saving…" : scope === "global" ? "Save globally" : "Save for dashboard"}
          </Button>
        </div>
      </header>

      <section
        className="appearance-page__section appearance-page__scope"
        aria-labelledby="appearance-scope-label"
      >
        <p id="appearance-scope-label" className="appearance-page__scope-label">
          Apply appearance to
        </p>
        <div
          className="appearance-scope"
          role="radiogroup"
          aria-labelledby="appearance-scope-label"
        >
          <label className={scope === "global" ? "is-selected" : undefined}>
            <input
              type="radio"
              name="appearance-scope"
              value="global"
              checked={scope === "global"}
              onChange={() => {
                setScope("global");
                setMessage(null);
              }}
            />
            All dashboards
          </label>
          <label className={scope === "dashboard" ? "is-selected" : undefined}>
            <input
              type="radio"
              name="appearance-scope"
              value="dashboard"
              checked={scope === "dashboard"}
              onChange={() => {
                setScope("dashboard");
                if (!dashboardOverride) {
                  setDashboardDraft(draftFromPreferences(preferences));
                }
                setMessage(null);
              }}
            />
            Current dashboard only
          </label>
        </div>
        <output className="appearance-page__scope-hint">
          {scope === "global"
            ? "Editing global preferences. Dashboards with their own override keep that override."
            : dashboardOverride
              ? "Editing an active override for this dashboard."
              : "No override yet. Saving will create one for this dashboard only."}
        </output>
        {scope === "dashboard" && dashboardOverride ? (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={busy}
            onClick={() => void useGlobalAppearance()}
          >
            Use global appearance
          </Button>
        ) : null}
      </section>

      {message ? <output className="appearance-page__message">{message}</output> : null}
      {error ? (
        <p className="appearance-page__error" role="alert">
          {error}
        </p>
      ) : null}
      {dirty ? (
        <output className="appearance-page__dirty">
          Unsaved preview — save to persist {scope === "global" ? "globally" : "for this dashboard"}
          .
        </output>
      ) : null}

      <div className="appearance-page__grid">
        <section className="appearance-page__section" aria-labelledby="appearance-mode">
          <SectionHeader
            id="appearance-mode"
            title="Color mode"
            description="Quick light/dark/system preference for this scope."
          />
          <Select
            label="Mode"
            value={activeDraft.mode}
            options={[
              { value: "system", label: "System" },
              { value: "light", label: "Light" },
              { value: "dark", label: "Dark" },
            ]}
            onChange={(event) => {
              patchActive({ mode: event.target.value as ThemeMode });
            }}
          />
        </section>

        <section className="appearance-page__section" aria-labelledby="appearance-presets">
          <SectionHeader
            id="appearance-presets"
            title="Presets"
            description="Four built-in palettes. Accent and density layer on top."
          />
          <div className="appearance-presets">
            {THEME_PRESET_META.map((preset) => {
              const selected = activeDraft.preset === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  className={`appearance-preset${selected ? " is-selected" : ""}`}
                  aria-pressed={selected}
                  aria-label={preset.name}
                  onClick={() => {
                    patchActive({ preset: preset.id as ThemePresetId });
                  }}
                >
                  <span
                    className="appearance-preset__swatches"
                    data-preset={preset.id}
                    aria-hidden="true"
                  >
                    <span className="appearance-preset__swatch appearance-preset__swatch--canvas" />
                    <span className="appearance-preset__swatch appearance-preset__swatch--surface" />
                    <span className="appearance-preset__swatch appearance-preset__swatch--accent" />
                  </span>
                  <span className="appearance-preset__meta">
                    <span className="appearance-preset__name">{preset.name}</span>
                    <span className="appearance-preset__desc">{preset.description}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="appearance-page__section" aria-labelledby="appearance-accent">
          <SectionHeader
            id="appearance-accent"
            title="Accent"
            description="Overrides primary action and focus colors."
          />
          <div className="appearance-accents">
            {ACCENT_OPTIONS.map((accent) => {
              const selected = activeDraft.accent === accent.id;
              const swatch =
                accent.id === "custom"
                  ? (activeDraft.accentCustom ?? "#0f5c4c")
                  : getAccentSwatch(accent.id, resolved);
              return (
                <button
                  key={accent.id}
                  type="button"
                  className={`appearance-accent${selected ? " is-selected" : ""}`}
                  aria-pressed={selected}
                  aria-label={accent.label}
                  onClick={() => {
                    patchActive({
                      accent: accent.id,
                      ...(accent.id === "custom" && !activeDraft.accentCustom
                        ? { accentCustom: "#0EA5E9" }
                        : {}),
                    });
                  }}
                >
                  <span
                    className="appearance-accent__swatch"
                    style={{ background: swatch }}
                    aria-hidden="true"
                  />
                  <span>{accent.label}</span>
                </button>
              );
            })}
          </div>
          {activeDraft.accent === "custom" ? (
            <Input
              label="Custom accent"
              type="color"
              value={(activeDraft.accentCustom ?? "#0EA5E9").toLowerCase()}
              onChange={(event) => {
                patchActive({ accentCustom: event.target.value.toUpperCase() });
              }}
            />
          ) : null}
        </section>

        <section className="appearance-page__section" aria-labelledby="appearance-layout">
          <SectionHeader
            id="appearance-layout"
            title="Layout"
            description="Density and card shape."
          />
          <Stack gap="md">
            <Select
              label="Density"
              value={activeDraft.density}
              options={[
                { value: "comfortable", label: "Comfortable" },
                { value: "compact", label: "Compact" },
                { value: "dense", label: "Dense" },
              ]}
              onChange={(event) => {
                patchActive({ density: event.target.value as ThemeDensity });
              }}
            />
            <Select
              label="Card radius"
              value={activeDraft.cardRadius}
              options={[
                { value: "sharp", label: "Sharp" },
                { value: "soft", label: "Soft" },
                { value: "rounded", label: "Rounded" },
              ]}
              onChange={(event) => {
                patchActive({ cardRadius: event.target.value as CardRadius });
              }}
            />
          </Stack>
        </section>

        <section className="appearance-page__section" aria-labelledby="appearance-access">
          <SectionHeader
            id="appearance-access"
            title="Comfort"
            description="Reduce motion, transparency, or ambient canvas glow."
          />
          <Stack gap="md">
            <Switch
              label="Reduced motion"
              checked={activeDraft.reducedMotion}
              onChange={(event) => {
                patchActive({ reducedMotion: event.target.checked });
              }}
            />
            <Switch
              label="Reduced transparency"
              checked={activeDraft.reducedTransparency}
              onChange={(event) => {
                patchActive({ reducedTransparency: event.target.checked });
              }}
            />
            <Switch
              label="Ambient background"
              checked={activeDraft.ambientBackground}
              onChange={(event) => {
                patchActive({ ambientBackground: event.target.checked });
              }}
            />
          </Stack>
        </section>

        {scope === "global" ? (
          <section className="appearance-page__section" aria-labelledby="appearance-brand">
            <SectionHeader
              id="appearance-brand"
              title="Branding"
              description={`Optional custom name and logo. Default app name is ${envAppName}.`}
            />
            <Stack gap="md">
              <Input
                label="App name"
                value={globalDraft.appName ?? ""}
                placeholder={envAppName}
                maxLength={40}
                onChange={(event) => {
                  const value = event.target.value.trim();
                  patchActive({ appName: value.length > 0 ? value : null });
                }}
              />
              <div className="appearance-logo-field">
                <label className="ds-label" htmlFor="appearance-logo">
                  Custom logo
                </label>
                <input
                  id="appearance-logo"
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  onChange={(event) => {
                    void onLogoChange(event);
                  }}
                />
                {globalDraft.logoDataUrl ? (
                  <div className="appearance-logo-preview">
                    <img
                      src={globalDraft.logoDataUrl}
                      alt="Custom logo preview"
                      width={40}
                      height={40}
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        patchActive({ logoDataUrl: null });
                      }}
                    >
                      Remove logo
                    </Button>
                  </div>
                ) : null}
              </div>
            </Stack>
          </section>
        ) : null}

        <section
          className="appearance-page__section appearance-page__preview"
          aria-labelledby="appearance-preview"
        >
          <SectionHeader
            id="appearance-preview"
            title="Live preview"
            description={`Previewing ${scope === "global" ? "global" : "current dashboard"} scope.`}
          />
          <div className="appearance-state-grid">
            {(
              [
                ["success", "Healthy"],
                ["loading", "Loading"],
                ["empty", "Empty"],
                ["stale", "Stale"],
                ["error", "Error"],
                ["disabled", "Disabled"],
              ] as const
            ).map(([state, label]) => (
              <article
                key={state}
                className={`widget-instance appearance-state-card appearance-state-card--${state}`}
              >
                <header className="widget-instance__header">
                  <div className="widget-instance__heading">
                    <h3 className="widget-instance__title">{label}</h3>
                  </div>
                </header>
                <div className="widget-instance__body">
                  <p className="widget-instance__description">
                    {state === "success"
                      ? "Token-driven surfaces stay readable in every preset."
                      : state === "loading"
                        ? "Skeleton placeholders inherit muted tokens."
                        : state === "empty"
                          ? "Quiet empty copy uses muted foreground."
                          : state === "stale"
                            ? "Stale data keeps last-good content visible."
                            : state === "error"
                              ? "Errors use danger tokens without hard-coded colors."
                              : "Disabled chrome dims via opacity and muted text."}
                  </p>
                </div>
              </article>
            ))}
          </div>
          <p className="appearance-page__hint">
            Defaults: {DEFAULT_THEME_PREFERENCES.preset} · {DEFAULT_THEME_PREFERENCES.density} ·{" "}
            {DEFAULT_THEME_PREFERENCES.cardRadius}
          </p>
        </section>
      </div>

      <Dialog
        open={leaveOpen}
        onOpenChange={(open) => {
          setLeaveOpen(open);
          if (!open) {
            setPendingLeaveTo(null);
          }
        }}
        title="Discard unsaved changes?"
        description="Your appearance preview has not been saved."
        footer={
          <>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setLeaveOpen(false);
                setPendingLeaveTo(null);
              }}
            >
              Keep editing
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={() => {
                const destination = pendingLeaveTo ?? returnTo;
                setLeaveOpen(false);
                setPendingLeaveTo(null);
                discard();
                if (onRequestLeave) {
                  onRequestLeave(destination);
                  return;
                }
                navigate(destination);
              }}
            >
              Discard and leave
            </Button>
          </>
        }
      >
        <DialogBody>
          <p>Save your changes first if you want to keep them.</p>
        </DialogBody>
      </Dialog>
    </div>
  );
}
