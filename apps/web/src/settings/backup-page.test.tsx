import type { DashoraExport, ImportSummary } from "@dashora/shared";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { BackupApi } from "./backup-api.js";
import { BackupPage } from "./backup-page.js";

afterEach(() => {
  cleanup();
});

const sampleExport: DashoraExport = {
  format: "dashora-config",
  formatVersion: 1,
  exportedAt: "2026-07-31T09:00:00.000Z",
  generator: { app: "dashora", serverVersion: "0.1.0-test" },
  data: { themePreferences: null, integrations: [], dashboards: [] },
};

const sampleSummary: ImportSummary = {
  mode: "merge",
  dashboardsCreated: 1,
  pagesCreated: 3,
  widgetsCreated: 5,
  todosCreated: 2,
  integrationsCreated: 1,
  skippedIntegrations: [
    {
      id: "11111111-1111-4111-8111-111111111111",
      provider: "github",
      name: "GitHub",
      reason: "secret_required",
    },
  ],
  themePreferencesApplied: false,
  renamedSlugs: [{ from: "default", to: "default-2" }],
  warnings: ["Cleared a stale reference."],
};

function createMockApi(overrides: Partial<BackupApi> = {}): BackupApi {
  return {
    exportConfig: vi.fn(async () => sampleExport),
    previewImport: vi.fn(async () => sampleSummary),
    runImport: vi.fn(async () => sampleSummary),
    ...overrides,
  };
}

function jsonFile(payload: unknown, name = "backup.json"): File {
  return new File([JSON.stringify(payload)], name, { type: "application/json" });
}

beforeAll(() => {
  window.URL.createObjectURL = vi.fn(() => "blob:mock-url");
  window.URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
});

describe("BackupPage", () => {
  it("downloads an export via the API", async () => {
    const api = createMockApi();
    render(<BackupPage api={api} />);

    expect(screen.getByRole("heading", { name: "Backup" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Download backup" }));

    await waitFor(() => {
      expect(api.exportConfig).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByText("Backup downloaded.")).toBeTruthy();
  });

  it("shows an error for a non-JSON file and does not enable Validate", async () => {
    const api = createMockApi();
    render(<BackupPage api={api} />);

    const input = screen.getByLabelText("Backup file") as HTMLInputElement;
    const badFile = new File(["not json"], "backup.json", { type: "application/json" });
    fireEvent.change(input, { target: { files: [badFile] } });

    await waitFor(() => {
      expect(screen.getByText('"backup.json" is not valid JSON.')).toBeTruthy();
    });
    expect((screen.getByRole("button", { name: "Validate" }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  it("previews and confirms an import", async () => {
    const api = createMockApi();
    render(<BackupPage api={api} />);

    const input = screen.getByLabelText("Backup file") as HTMLInputElement;
    fireEvent.change(input, { target: { files: [jsonFile(sampleExport)] } });

    await waitFor(() => {
      expect((screen.getByRole("button", { name: "Validate" }) as HTMLButtonElement).disabled).toBe(
        false,
      );
    });
    fireEvent.click(screen.getByRole("button", { name: "Validate" }));

    await waitFor(() => {
      expect(api.previewImport).toHaveBeenCalledWith("merge", sampleExport);
    });
    expect(screen.getByRole("heading", { name: "Import summary" })).toBeTruthy();
    expect(screen.getByText(/GitHub/)).toBeTruthy();
    expect(screen.getByText("default")).toBeTruthy();
    expect(screen.getByText("default-2")).toBeTruthy();
    expect(screen.getByText("Cleared a stale reference.")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Confirm import" }));

    await waitFor(() => {
      expect(api.runImport).toHaveBeenCalledWith("merge", sampleExport);
    });
    await waitFor(() => {
      expect(screen.getByText(/Import complete/)).toBeTruthy();
    });
    expect(screen.queryByRole("heading", { name: "Import summary" })).toBeNull();
  });

  it("surfaces a rolled-back import failure", async () => {
    class FakeApiError extends Error {}
    const api = createMockApi({
      runImport: vi.fn(async () => {
        throw new FakeApiError("Import failed and was rolled back; no changes were made.");
      }),
    });
    render(<BackupPage api={api} />);

    const input = screen.getByLabelText("Backup file") as HTMLInputElement;
    fireEvent.change(input, { target: { files: [jsonFile(sampleExport)] } });
    await waitFor(() => {
      expect((screen.getByRole("button", { name: "Validate" }) as HTMLButtonElement).disabled).toBe(
        false,
      );
    });
    fireEvent.click(screen.getByRole("button", { name: "Validate" }));
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Import summary" })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: "Confirm import" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeTruthy();
    });
    expect(screen.queryByRole("heading", { name: "Import summary" })).toBeNull();
  });
});
