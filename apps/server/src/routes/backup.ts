import {
  ExportFormatError,
  dashoraExportSchema,
  importRequestSchema,
  importSummaryResponseSchema,
} from "@dashora/shared";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { isStateChangingMethod, sendCsrfError, validateCsrf } from "../auth/csrf.js";
import type { SessionService } from "../auth/session-service.js";
import { sendApiError } from "../http/errors.js";
import type { AuditService } from "../services/audit-service.js";
import { type BackupService, BackupServiceError } from "../services/backup-service.js";

export type BackupRouteOptions = {
  sessions: SessionService;
  backup: BackupService;
  /** Per-route Fastify body size limit for import uploads, in bytes. */
  maxImportBytes: number;
  audit: AuditService;
};

async function requireCsrf(request: FastifyRequest, reply: FastifyReply): Promise<boolean> {
  if (!isStateChangingMethod(request.method)) {
    return true;
  }
  if (!validateCsrf(request)) {
    await sendCsrfError(reply);
    return false;
  }
  return true;
}

/** Audit writes must never break the request they observe — log and continue on failure. */
async function recordAudit(
  app: FastifyInstance,
  audit: AuditService,
  input: Parameters<AuditService["record"]>[0],
): Promise<void> {
  try {
    await audit.record(input);
  } catch (error) {
    app.log.error({ err: error }, "Failed to record audit event");
  }
}

/** Every `ExportFormatError` reason (bad shape, unsupported version, schema failure) is a client error. */
const EXPORT_FORMAT_ERROR_STATUS = 400;

function backupFilename(): string {
  const isoDate = new Date().toISOString().slice(0, 10);
  return `dashora-backup-${isoDate}.json`;
}

export async function registerBackupRoutes(
  app: FastifyInstance,
  options: BackupRouteOptions,
): Promise<void> {
  const { sessions, backup, maxImportBytes, audit } = options;

  app.get("/api/v1/backup/export", async (request, reply) => {
    const auth = await sessions.resolveSession(request, reply);
    if (!auth) {
      return sendApiError(reply, 401, "unauthenticated", "Authentication required");
    }

    const exported = dashoraExportSchema.parse(await backup.exportConfig(auth.user.id));
    await recordAudit(app, audit, {
      event: "backup.export",
      success: true,
      actorUserId: auth.user.id,
      actorEmail: auth.user.email,
      ip: request.ip,
    });
    return reply
      .header("content-type", "application/json; charset=utf-8")
      .header("content-disposition", `attachment; filename="${backupFilename()}"`)
      .send(exported);
  });

  app.post(
    "/api/v1/backup/import/preview",
    { bodyLimit: maxImportBytes },
    async (request, reply) => {
      if (!(await requireCsrf(request, reply))) {
        return;
      }
      const auth = await sessions.resolveSession(request, reply);
      if (!auth) {
        return sendApiError(reply, 401, "unauthenticated", "Authentication required");
      }

      const parsed = importRequestSchema.safeParse(request.body);
      if (!parsed.success) {
        return sendApiError(reply, 400, "validation_error", "Invalid import request payload");
      }

      try {
        const summary = await backup.previewImport(
          auth.user.id,
          parsed.data.file,
          parsed.data.mode,
        );
        return importSummaryResponseSchema.parse({ summary });
      } catch (error) {
        if (error instanceof ExportFormatError) {
          return sendApiError(reply, EXPORT_FORMAT_ERROR_STATUS, error.code, error.message);
        }
        throw error;
      }
    },
  );

  app.post("/api/v1/backup/import", { bodyLimit: maxImportBytes }, async (request, reply) => {
    if (!(await requireCsrf(request, reply))) {
      return;
    }
    const auth = await sessions.resolveSession(request, reply);
    if (!auth) {
      return sendApiError(reply, 401, "unauthenticated", "Authentication required");
    }

    const parsed = importRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return sendApiError(reply, 400, "validation_error", "Invalid import request payload");
    }

    try {
      const summary = await backup.runImport(auth.user.id, parsed.data.file, parsed.data.mode);
      await recordAudit(app, audit, {
        event: "backup.import",
        success: true,
        actorUserId: auth.user.id,
        actorEmail: auth.user.email,
        ip: request.ip,
        metadata: { mode: parsed.data.mode },
      });
      return importSummaryResponseSchema.parse({ summary });
    } catch (error) {
      if (error instanceof ExportFormatError) {
        return sendApiError(reply, EXPORT_FORMAT_ERROR_STATUS, error.code, error.message);
      }
      if (error instanceof BackupServiceError) {
        return sendApiError(reply, 500, error.code, error.message);
      }
      throw error;
    }
  });
}
