import type { CreatePageRequest, Page, PageIcon, UpdatePageRequest } from "@dashora/shared";
import { PAGE_ICONS } from "@dashora/shared";
import { Button, Dialog, DialogBody, Input, Select, Stack } from "@dashora/ui";
import { useEffect, useId, useState } from "react";
import { PAGE_ICON_OPTIONS, PageIconGlyph } from "./page-icons.js";
import { slugifyName } from "./page-routing.js";

const ACCENT_PRESETS = ["#0EA5E9", "#22C55E", "#F59E0B", "#EF4444", "#A855F7", "#64748B"] as const;

export type PageEditorMode = "create" | "edit";

export type PageEditorDialogProps = {
  open: boolean;
  mode: PageEditorMode;
  initial?: Page | null;
  busy?: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: CreatePageRequest | UpdatePageRequest) => Promise<boolean>;
};

export function PageEditorDialog({
  open,
  mode,
  initial,
  busy = false,
  onOpenChange,
  onSubmit,
}: PageEditorDialogProps) {
  const nameId = useId();
  const slugId = useId();
  const iconId = useId();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [icon, setIcon] = useState<PageIcon>("grid");
  const [accent, setAccent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    setError(null);
    if (mode === "edit" && initial) {
      setName(initial.name);
      setSlug(initial.slug);
      setSlugTouched(true);
      setIcon(initial.icon);
      setAccent(initial.accent);
      return;
    }
    setName("");
    setSlug("");
    setSlugTouched(false);
    setIcon("grid");
    setAccent(null);
  }, [open, mode, initial]);

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={mode === "create" ? "Create page" : "Edit page"}
      description={
        mode === "create"
          ? "Add a page to your dashboard navigation."
          : "Update the page name, slug, icon, or accent."
      }
      footer={
        <>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={busy || name.trim().length === 0 || slug.trim().length === 0}
            onClick={() => {
              void (async () => {
                setError(null);
                const payload =
                  mode === "create"
                    ? ({
                        name: name.trim(),
                        slug: slug.trim().toLowerCase(),
                        icon,
                        accent,
                      } satisfies CreatePageRequest)
                    : ({
                        name: name.trim(),
                        slug: slug.trim().toLowerCase(),
                        icon,
                        accent,
                      } satisfies UpdatePageRequest);
                const ok = await onSubmit(payload);
                if (!ok) {
                  setError("Could not save the page. Check the slug is unique and try again.");
                }
              })();
            }}
          >
            {mode === "create" ? "Create" : "Save"}
          </Button>
        </>
      }
    >
      <DialogBody>
        <Stack gap="md">
          <Input
            id={nameId}
            label="Name"
            value={name}
            onChange={(event) => {
              const next = event.target.value;
              setName(next);
              if (!slugTouched) {
                setSlug(slugifyName(next));
              }
            }}
            placeholder="Markets"
            autoComplete="off"
          />

          <Input
            id={slugId}
            label="Slug"
            hint={`Used in the URL as /${slug || "slug"}`}
            value={slug}
            onChange={(event) => {
              setSlugTouched(true);
              setSlug(event.target.value.toLowerCase());
            }}
            placeholder="markets"
            autoComplete="off"
            spellCheck={false}
          />

          <div className="page-form__field">
            <Select
              id={iconId}
              label="Icon"
              value={icon}
              options={PAGE_ICON_OPTIONS.map((option) => ({
                value: option.value,
                label: option.label,
              }))}
              onChange={(event) => {
                const value = event.target.value;
                if ((PAGE_ICONS as readonly string[]).includes(value)) {
                  setIcon(value as PageIcon);
                }
              }}
            />
            <span className="page-form__icon-preview" aria-hidden="true">
              <PageIconGlyph icon={icon} />
            </span>
          </div>

          <fieldset className="page-form__accents">
            <legend className="page-form__label">Accent</legend>
            <div className="page-form__accent-row">
              <button
                type="button"
                className={`page-form__accent page-form__accent--none${accent === null ? " is-selected" : ""}`}
                onClick={() => setAccent(null)}
                aria-pressed={accent === null}
              >
                None
              </button>
              {ACCENT_PRESETS.map((color) => (
                <button
                  key={color}
                  type="button"
                  className={`page-form__accent${accent === color ? " is-selected" : ""}`}
                  style={{ background: color }}
                  aria-label={`Accent ${color}`}
                  aria-pressed={accent === color}
                  onClick={() => setAccent(color)}
                />
              ))}
            </div>
          </fieldset>

          {error ? <p className="page-form__error">{error}</p> : null}
        </Stack>
      </DialogBody>
    </Dialog>
  );
}

export type ConfirmDeletePageDialogProps = {
  open: boolean;
  page: Page | null;
  busy?: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<boolean>;
};

export function ConfirmDeletePageDialog({
  open,
  page,
  busy = false,
  onOpenChange,
  onConfirm,
}: ConfirmDeletePageDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Delete page"
      description={
        page
          ? `Delete “${page.name}”? This cannot be undone. Widgets on this page will be removed.`
          : "Delete this page?"
      }
      footer={
        <>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="danger"
            disabled={busy || !page}
            onClick={() => {
              void (async () => {
                const ok = await onConfirm();
                if (ok) {
                  onOpenChange(false);
                }
              })();
            }}
          >
            Delete
          </Button>
        </>
      }
    >
      <DialogBody>
        <p className="page-form__hint">
          At least one page must remain on the dashboard. Confirm only if you are sure.
        </p>
      </DialogBody>
    </Dialog>
  );
}
