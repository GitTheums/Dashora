import {
  type DashoraExport,
  type ImportMode,
  type ImportSummary,
  apiErrorSchema,
  dashoraExportSchema,
  importSummaryResponseSchema,
} from "@dashora/shared";

export class BackupApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "BackupApiError";
    this.status = status;
    this.code = code;
  }
}

function apiUrl(path: string, baseUrl: string): string {
  const normalizedBase = baseUrl.replace(/\/$/, "");
  return `${normalizedBase}${path}`;
}

function readCookie(name: string): string | null {
  if (typeof document === "undefined") {
    return null;
  }
  const prefix = `${name}=`;
  const parts = document.cookie.split("; ");
  for (const part of parts) {
    if (part.startsWith(prefix)) {
      return decodeURIComponent(part.slice(prefix.length));
    }
  }
  return null;
}

async function parseError(response: Response): Promise<BackupApiError> {
  try {
    const json: unknown = await response.json();
    const parsed = apiErrorSchema.safeParse(json);
    if (parsed.success) {
      return new BackupApiError(response.status, parsed.data.error.code, parsed.data.error.message);
    }
  } catch {
    // fall through
  }
  if (response.status === 413) {
    return new BackupApiError(response.status, "payload_too_large", "Backup file is too large");
  }
  return new BackupApiError(response.status, "request_failed", "Request failed");
}

export type BackupApi = {
  exportConfig: () => Promise<DashoraExport>;
  previewImport: (mode: ImportMode, file: unknown) => Promise<ImportSummary>;
  runImport: (mode: ImportMode, file: unknown) => Promise<ImportSummary>;
};

export function createBackupApi(baseUrl: string): BackupApi {
  async function request(path: string, init: RequestInit = {}): Promise<Response> {
    return fetch(apiUrl(path, baseUrl), {
      ...init,
      credentials: "include",
      headers: {
        ...(init.body ? { "content-type": "application/json" } : {}),
        ...init.headers,
      },
    });
  }

  async function ensureCsrf(): Promise<string> {
    const existing = readCookie("dashora_csrf");
    if (existing) {
      return existing;
    }
    const response = await request("/api/v1/auth/csrf");
    if (!response.ok) {
      throw await parseError(response);
    }
    const body = (await response.json()) as { csrfToken: string };
    return body.csrfToken;
  }

  async function mutating(path: string, method: string, body?: unknown): Promise<Response> {
    const csrfToken = await ensureCsrf();
    return request(path, {
      method,
      headers: {
        "x-csrf-token": csrfToken,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  }

  return {
    async exportConfig() {
      const response = await request("/api/v1/backup/export");
      if (!response.ok) {
        throw await parseError(response);
      }
      return dashoraExportSchema.parse(await response.json());
    },

    async previewImport(mode, file) {
      const response = await mutating("/api/v1/backup/import/preview", "POST", { mode, file });
      if (!response.ok) {
        throw await parseError(response);
      }
      return importSummaryResponseSchema.parse(await response.json()).summary;
    },

    async runImport(mode, file) {
      const response = await mutating("/api/v1/backup/import", "POST", { mode, file });
      if (!response.ok) {
        throw await parseError(response);
      }
      return importSummaryResponseSchema.parse(await response.json()).summary;
    },
  };
}
