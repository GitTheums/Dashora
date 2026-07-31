import {
  type IframeAdapter,
  IframeAdapterError,
  type IframeEmbedProbe,
} from "@dashora/widget-sdk/widgets/iframe/server";
import { isProviderError } from "../errors.js";
import type { ProviderPlatform } from "../platform.js";
import { safeUrlLabel } from "../redact.js";
import { createSsrfUrlValidator } from "../ssrf.js";

function parseFrameAncestors(csp: string | undefined): string[] | null {
  if (!csp) {
    return null;
  }
  const directives = csp.split(";").map((part) => part.trim().toLowerCase());
  for (const directive of directives) {
    if (directive.startsWith("frame-ancestors")) {
      const tokens = directive.slice("frame-ancestors".length).trim().split(/\s+/).filter(Boolean);
      return tokens;
    }
  }
  return null;
}

export function evaluateEmbeddingHeaders(headers: Record<string, string>): {
  embeddingRefused: boolean;
  warning: string | null;
} {
  const normalized: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    normalized[key.toLowerCase()] = value;
  }

  const xfo = normalized["x-frame-options"]?.toLowerCase();
  if (xfo === "deny" || xfo === "sameorigin") {
    return {
      embeddingRefused: true,
      warning:
        xfo === "deny"
          ? "The target sets X-Frame-Options: DENY and will refuse embedding."
          : "The target sets X-Frame-Options: SAMEORIGIN and will refuse cross-origin embedding.",
    };
  }

  const csp = normalized["content-security-policy"];
  const ancestors = parseFrameAncestors(csp);
  if (ancestors) {
    if (ancestors.includes("'none'")) {
      return {
        embeddingRefused: true,
        warning: "The target CSP frame-ancestors is 'none' and will refuse embedding.",
      };
    }
    const allowsAny = ancestors.includes("*");
    const allowsSelfOnly =
      ancestors.length === 1 && (ancestors[0] === "'self'" || ancestors[0] === "self");
    if (!allowsAny && allowsSelfOnly) {
      return {
        embeddingRefused: true,
        warning:
          "The target CSP frame-ancestors allows only 'self' and will refuse cross-origin embedding.",
      };
    }
    if (!allowsAny && !ancestors.some((token) => token.includes("*") || token.startsWith("http"))) {
      // Restrictive list without wildcard — warn conservatively.
      return {
        embeddingRefused: true,
        warning: "The target CSP frame-ancestors list likely excludes this dashboard origin.",
      };
    }
  }

  return { embeddingRefused: false, warning: null };
}

export function createIframeEmbedProbeAdapter(options: {
  platform: ProviderPlatform;
}): IframeAdapter {
  return {
    id: "iframe-embed-probe",
    async probeEmbedding(request): Promise<IframeEmbedProbe> {
      const validateUrl = createSsrfUrlValidator({ allowPrivateNetwork: false });
      const now = request.now ?? new Date();
      try {
        const result = await options.platform.fetch({
          providerId: "iframe-embed-probe",
          url: request.url,
          method: "GET",
          headers: {
            accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
          },
          ...(request.signal ? { signal: request.signal } : {}),
          forceRefresh: true,
          retry: false,
          cachePolicy: { ttlSeconds: 0, staleWhileRevalidateSeconds: 0 },
          validateUrl,
        });

        const evaluation = evaluateEmbeddingHeaders(result.response.headers);
        return {
          checkedAt: now.toISOString(),
          embeddingRefused: evaluation.embeddingRefused,
          warning: evaluation.warning,
          urlLabel: safeUrlLabel(request.url),
        };
      } catch (error) {
        if (isProviderError(error) && error.code === "ssrf_blocked") {
          throw new IframeAdapterError(
            "ssrf_blocked",
            "Embed probe blocked by outbound network protections.",
          );
        }
        throw new IframeAdapterError(
          "probe_failed",
          "Could not verify whether the target allows embedding.",
        );
      }
    },
  };
}
