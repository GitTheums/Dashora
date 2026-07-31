import type { ImportMode, ImportSummary } from "@dashora/shared";
import { Badge, Button, Dialog, DialogBody, SectionHeader, Select, Stack } from "@dashora/ui";
import { type ChangeEvent, useEffect, useRef, useState } from "react";
import { type BackupApi, BackupApiError } from "./backup-api.js";

export type BackupPageProps = {
  api: BackupApi;
};

type SelectedImportFile = {
  name: string;
  payload: unknown;
};

/** Client-side sanity check only; the server enforces the authoritative limit. */
const CLIENT_MAX_IMPORT_BYTES = 8_000_000;

function backupFilename(): string {
  return `dashora-backup-${new Date().toISOString().slice(0, 10)}.json`;
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }
      reject(new Error("Could not read backup file"));
    };
    reader.onerror = () => {
      reject(new Error("Could not read backup file"));
    };
    reader.readAsText(file);
  });
}

function ImportSummaryView({ summary }: { summary: ImportSummary }) {
  return (
    <Stack gap="md">
      <dl className="backup-page__summary-grid">
        <div>
          <dt>Dashboards</dt>
          <dd>{summary.dashboardsCreated}</dd>
        </div>
        <div>
          <dt>Pages</dt>
          <dd>{summary.pagesCreated}</dd>
        </div>
        <div>
          <dt>Widgets</dt>
          <dd>{summary.widgetsCreated}</dd>
        </div>
        <div>
          <dt>Tasks</dt>
          <dd>{summary.todosCreated}</dd>
        </div>
        <div>
          <dt>Integrations</dt>
          <dd>{summary.integrationsCreated}</dd>
        </div>
        <div>
          <dt>Appearance</dt>
          <dd>{summary.themePreferencesApplied ? "Applied" : "Unchanged"}</dd>
        </div>
      </dl>

      {summary.renamedSlugs.length > 0 ? (
        <div>
          <p className="backup-page__summary-label">Renamed to avoid conflicts</p>
          <ul className="backup-page__summary-list">
            {summary.renamedSlugs.map((rename) => (
              <li key={`${rename.from}->${rename.to}`}>
                <code>{rename.from}</code> → <code>{rename.to}</code>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {summary.skippedIntegrations.length > 0 ? (
        <div>
          <p className="backup-page__summary-label">Integrations need a secret</p>
          <ul className="backup-page__summary-list">
            {summary.skippedIntegrations.map((integration) => (
              <li key={integration.id}>
                <Badge tone="warning">Secret required</Badge> {integration.name} (
                {integration.provider})
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {summary.warnings.length > 0 ? (
        <div>
          <p className="backup-page__summary-label">Warnings</p>
          <ul className="backup-page__summary-list">
            {summary.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </Stack>
  );
}

export function BackupPage({ api }: BackupPageProps) {
  const [mode, setMode] = useState<ImportMode>("merge");
  const [selectedFile, setSelectedFile] = useState<SelectedImportFile | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewSummary, setPreviewSummary] = useState<ImportSummary | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.getElementById("backup-heading")?.focus();
  }, []);

  const resetFileInput = () => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const onFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setMessage(null);
    setError(null);
    setPreviewSummary(null);
    if (!file) {
      setSelectedFile(null);
      return;
    }
    if (file.size > CLIENT_MAX_IMPORT_BYTES) {
      setError(
        `"${file.name}" is too large to import (max ${(CLIENT_MAX_IMPORT_BYTES / 1_000_000).toFixed(0)} MB).`,
      );
      resetFileInput();
      return;
    }
    try {
      const text = await readFileAsText(file);
      const payload = JSON.parse(text) as unknown;
      setSelectedFile({ name: file.name, payload });
    } catch {
      setError(`"${file.name}" is not valid JSON.`);
      resetFileInput();
    }
  };

  const downloadBackup = async () => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const exported = await api.exportConfig();
      const blob = new Blob([JSON.stringify(exported, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = backupFilename();
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setMessage("Backup downloaded.");
    } catch (err) {
      setError(err instanceof BackupApiError ? err.message : "Failed to export backup");
    } finally {
      setBusy(false);
    }
  };

  const validateImport = async () => {
    if (!selectedFile) {
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const summary = await api.previewImport(mode, selectedFile.payload);
      setPreviewSummary(summary);
      setPreviewOpen(true);
    } catch (err) {
      setError(err instanceof BackupApiError ? err.message : "Failed to validate backup file");
    } finally {
      setBusy(false);
    }
  };

  const confirmImport = async () => {
    if (!selectedFile) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const summary = await api.runImport(mode, selectedFile.payload);
      setPreviewOpen(false);
      setPreviewSummary(null);
      resetFileInput();
      setMessage(
        `Import complete: ${summary.dashboardsCreated} dashboard(s), ${summary.pagesCreated} page(s), ${summary.widgetsCreated} widget(s) restored.`,
      );
    } catch (err) {
      setPreviewOpen(false);
      setError(err instanceof BackupApiError ? err.message : "Import failed and was rolled back");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="backup-page">
      <header className="backup-page__header">
        <h1 className="backup-page__title" tabIndex={-1} id="backup-heading">
          Backup
        </h1>
        <p className="backup-page__lede">
          Export your dashboards, pages, widgets, and appearance to a JSON file, or restore from a
          previous export.
        </p>
      </header>

      {message ? <output className="backup-page__message">{message}</output> : null}
      {error ? (
        <p className="backup-page__error" role="alert">
          {error}
        </p>
      ) : null}

      <section className="backup-page__section" aria-labelledby="backup-export">
        <SectionHeader
          id="backup-export"
          title="Export configuration"
          description="Downloads a versioned JSON file with your dashboards, pages, widget layouts, tasks, appearance, and non-secret integration metadata. Provider secrets, such as tokens and passwords, are never included."
        />
        <div>
          <Button type="button" disabled={busy} onClick={() => void downloadBackup()}>
            {busy ? "Preparing…" : "Download backup"}
          </Button>
        </div>
      </section>

      <section className="backup-page__section" aria-labelledby="backup-import">
        <SectionHeader
          id="backup-import"
          title="Import configuration"
          description="Restore from a previously exported file. Every imported integration will need its secret re-entered, since secrets are never exported."
        />
        <Stack gap="md">
          <Select
            label="Import mode"
            value={mode}
            options={[
              { value: "merge", label: "Merge — add alongside existing data" },
              { value: "replace", label: "Replace — delete existing data first" },
            ]}
            onChange={(event) => {
              setMode(event.target.value as ImportMode);
              setPreviewSummary(null);
            }}
          />
          <div className="backup-page__file-field">
            <label className="ds-label" htmlFor="backup-import-file">
              Backup file
            </label>
            <input
              ref={fileInputRef}
              id="backup-import-file"
              type="file"
              accept="application/json,.json"
              onChange={(event) => {
                void onFileChange(event);
              }}
            />
          </div>
          <div>
            <Button
              type="button"
              disabled={busy || !selectedFile}
              onClick={() => void validateImport()}
            >
              {busy ? "Validating…" : "Validate"}
            </Button>
          </div>
        </Stack>
      </section>

      <Dialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        title="Import summary"
        description={
          mode === "replace"
            ? "Replace mode deletes all of your current dashboards, pages, integrations, and appearance settings before importing."
            : "Merge mode adds the imported data alongside what you already have."
        }
        footer={
          <>
            <Button
              type="button"
              variant="secondary"
              disabled={busy}
              onClick={() => setPreviewOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant={mode === "replace" ? "danger" : "primary"}
              disabled={busy}
              onClick={() => void confirmImport()}
            >
              {busy ? "Importing…" : "Confirm import"}
            </Button>
          </>
        }
      >
        <DialogBody>
          {previewSummary ? <ImportSummaryView summary={previewSummary} /> : null}
        </DialogBody>
      </Dialog>
    </div>
  );
}
