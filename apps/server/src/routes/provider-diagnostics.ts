import { providerDiagnosticsResponseSchema } from "@dashora/shared";
import type { FastifyInstance } from "fastify";
import type { SessionService } from "../auth/session-service.js";
import { sendApiError } from "../http/errors.js";
import type { ProviderPlatform } from "../providers/platform.js";

export type ProviderDiagnosticsRouteOptions = {
  sessions: SessionService;
  providers: ProviderPlatform;
};

export async function registerProviderDiagnosticsRoutes(
  app: FastifyInstance,
  options: ProviderDiagnosticsRouteOptions,
): Promise<void> {
  app.get("/api/v1/admin/providers/diagnostics", async (request, reply) => {
    const auth = await options.sessions.resolveSession(request, reply);
    if (!auth) {
      return sendApiError(reply, 401, "unauthenticated", "Authentication required");
    }

    const payload = options.providers.getDiagnostics();
    return providerDiagnosticsResponseSchema.parse(payload);
  });
}
