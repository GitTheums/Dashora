import {
  type CustomApiAdapter,
  CustomApiAdapterError,
  type CustomApiFetchRequest,
  type CustomApiFetchResult,
  customApiDataSchema,
  isAllowedCustomApiHeaderName,
  mapJsonToPresentation,
  sanitizeHeaderLiteral,
} from "@dashora/widget-sdk/widgets/custom-api/server";
import { isProviderError } from "../errors.js";
import type { ProviderPlatform } from "../platform.js";
import { redactUrl, safeUrlLabel } from "../redact.js";
import { createSsrfUrlValidator } from "../ssrf.js";

const CUSTOM_API_MAX_RESPONSE_BYTES = 512_000;

export type CustomApiAdapterOptions = {
  platform: ProviderPlatform;
};

function collectSecretIds(config: CustomApiFetchRequest["config"]): string[] {
  const ids = new Set<string>();
  for (const header of config.headers) {
    if (typeof header.secretId === "string" && header.secretId) {
      ids.add(header.secretId);
    }
  }
  return [...ids].sort();
}

async function buildHeaders(request: CustomApiFetchRequest): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    accept: "application/json, text/plain;q=0.9, */*;q=0.1",
  };

  for (const header of request.config.headers) {
    if (!isAllowedCustomApiHeaderName(header.name)) {
      throw new CustomApiAdapterError("invalid_header", `Header "${header.name}" is not allowed.`);
    }
    const name = header.name.trim();
    let value: string | null = null;
    if (typeof header.secretId === "string" && header.secretId) {
      const secret = await request.resolveSecret(header.secretId);
      if (!secret) {
        throw new CustomApiAdapterError(
          "configuration_required",
          "A linked API secret could not be resolved. Store it under Integrations or update the header.",
        );
      }
      value = sanitizeHeaderLiteral(secret);
    } else {
      value = sanitizeHeaderLiteral(header.value);
    }
    if (value === null) {
      throw new CustomApiAdapterError("invalid_header", `Header "${name}" has an invalid value.`);
    }
    headers[name] = value;
  }

  if (request.config.method === "POST" && request.config.body.trim()) {
    if (!Object.keys(headers).some((key) => key.toLowerCase() === "content-type")) {
      headers["content-type"] = "application/json";
    }
  }

  return headers;
}

export function createCustomApiAdapter(options: CustomApiAdapterOptions): CustomApiAdapter {
  return {
    id: "custom-api",
    async fetch(request): Promise<CustomApiFetchResult> {
      const config = request.config;
      const url = config.url.trim();
      if (!url) {
        throw new CustomApiAdapterError("configuration_required", "Set a request URL in settings.");
      }

      const validateUrl = createSsrfUrlValidator({
        allowPrivateNetwork: config.allowPrivateNetwork,
      });

      let timeoutSignal: AbortSignal | undefined;
      let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
      try {
        const controller = new AbortController();
        timeoutHandle = setTimeout(() => {
          controller.abort();
        }, config.timeoutMs);
        timeoutSignal = controller.signal;

        const combinedSignal =
          typeof AbortSignal.any === "function" && request.signal
            ? AbortSignal.any([request.signal, timeoutSignal])
            : (request.signal ?? timeoutSignal);

        const headers = await buildHeaders(request);
        const secretIds = collectSecretIds(config);
        const providerId = `custom-api:${secretIds.join(",") || "public"}`;

        const result = await options.platform.fetch({
          providerId,
          url,
          method: config.method,
          headers,
          ...(config.method === "POST" && config.body.trim() ? { body: config.body } : {}),
          signal: combinedSignal,
          forceRefresh: request.forceRefresh === true,
          retry: false,
          cachePolicy: {
            ttlSeconds: 60,
            staleWhileRevalidateSeconds: 300,
          },
          validateUrl,
        });

        // Enforce a tighter response size ceiling for operator-defined endpoints.
        if (Buffer.byteLength(result.response.bodyText, "utf8") > CUSTOM_API_MAX_RESPONSE_BYTES) {
          throw new CustomApiAdapterError(
            "too_large",
            "The upstream response exceeded the Custom API size limit.",
          );
        }

        let json: unknown;
        try {
          json = JSON.parse(result.response.bodyText) as unknown;
        } catch {
          throw new CustomApiAdapterError(
            "parse_error",
            "The upstream response was not valid JSON.",
          );
        }

        const presentation = mapJsonToPresentation(json, config);
        if (!presentation) {
          throw new CustomApiAdapterError(
            "mapping_failed",
            "Could not map the JSON response with the configured paths.",
          );
        }

        const now = request.now ?? new Date();
        const data = customApiDataSchema.parse({
          presentation,
          httpStatus: result.response.status,
          fetchedAt: now.toISOString(),
          urlLabel: safeUrlLabel(redactUrl(result.response.url || url)),
        });

        return {
          data,
          cacheStatus: result.cacheStatus,
        };
      } catch (error) {
        if (error instanceof CustomApiAdapterError) {
          throw error;
        }
        if (isProviderError(error)) {
          if (error.code === "ssrf_blocked") {
            throw new CustomApiAdapterError(
              "ssrf_blocked",
              error.message ||
                "The request target is blocked. Enable private-network access only for trusted LAN endpoints.",
            );
          }
          if (error.code === "request_timeout" || error.code === "connect_timeout") {
            throw new CustomApiAdapterError("timeout", "The Custom API request timed out.", true);
          }
          if (error.code === "too_large") {
            throw new CustomApiAdapterError(
              "too_large",
              "The upstream response exceeded the size limit.",
            );
          }
          if (error.code === "http_error") {
            throw new CustomApiAdapterError(
              "http_error",
              "The upstream API returned an error response.",
              error.retryable,
            );
          }
          throw new CustomApiAdapterError(
            error.code,
            "Could not complete the Custom API request.",
            error.retryable,
          );
        }
        if (error instanceof Error && error.name === "AbortError") {
          throw new CustomApiAdapterError("timeout", "The Custom API request timed out.", true);
        }
        throw new CustomApiAdapterError(
          "unknown",
          "Could not complete the Custom API request.",
          false,
        );
      } finally {
        if (timeoutHandle) {
          clearTimeout(timeoutHandle);
        }
      }
    },
  };
}
