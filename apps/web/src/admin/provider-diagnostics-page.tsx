import type { ProviderDiagnosticsEntry, ProviderDiagnosticsResponse } from "@dashora/shared";
import {
  Badge,
  type BadgeTone,
  Button,
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  ErrorState,
  SectionHeader,
  Skeleton,
  Stack,
} from "@dashora/ui";
import { useCallback, useEffect, useMemo, useState } from "react";
import { navigate } from "../auth/routing.js";
import {
  type ProviderDiagnosticsApi,
  ProviderDiagnosticsApiError,
  createProviderDiagnosticsApi,
} from "./provider-diagnostics-api.js";

export type ProviderDiagnosticsPageProps = {
  apiBaseUrl: string;
  api?: ProviderDiagnosticsApi;
};

type LoadState =
  | { status: "loading" }
  | { status: "ready"; data: ProviderDiagnosticsResponse }
  | { status: "error"; message: string };

function statusTone(status: ProviderDiagnosticsEntry["status"]): BadgeTone {
  switch (status) {
    case "healthy":
      return "success";
    case "degraded":
      return "warning";
    case "open":
      return "danger";
    case "idle":
      return "neutral";
    default:
      return "secondary";
  }
}

function circuitTone(state: ProviderDiagnosticsEntry["circuitState"]): BadgeTone {
  switch (state) {
    case "closed":
      return "success";
    case "half-open":
      return "warning";
    case "open":
      return "danger";
    default:
      return "neutral";
  }
}

function formatMs(value: number | null): string {
  if (value === null) {
    return "—";
  }
  return `${value} ms`;
}

function formatTimestamp(value: string | null): string {
  if (!value) {
    return "—";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }
  return date.toLocaleString();
}

export function ProviderDiagnosticsPage({
  apiBaseUrl,
  api: apiOverride,
}: ProviderDiagnosticsPageProps) {
  const api = useMemo(
    () => apiOverride ?? createProviderDiagnosticsApi(apiBaseUrl),
    [apiBaseUrl, apiOverride],
  );
  const [state, setState] = useState<LoadState>({ status: "loading" });

  const load = useCallback(async () => {
    setState({ status: "loading" });
    try {
      const data = await api.getDiagnostics();
      setState({ status: "ready", data });
    } catch (error) {
      const message =
        error instanceof ProviderDiagnosticsApiError
          ? error.message
          : "Could not load provider diagnostics.";
      setState({ status: "error", message });
    }
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="admin-page">
      <header className="admin-page__topbar">
        <div>
          <p className="admin-page__eyebrow">Administration</p>
          <h1 className="admin-page__title">Provider diagnostics</h1>
          <p className="admin-page__lede">
            Upstream fetch health, cache metrics, and timings. Secrets and credential values are
            never shown.
          </p>
        </div>
        <div className="admin-page__actions">
          <Button type="button" variant="ghost" onClick={() => navigate("/")}>
            Back to dashboard
          </Button>
          <Button type="button" variant="secondary" onClick={() => void load()}>
            Refresh
          </Button>
        </div>
      </header>

      {state.status === "loading" ? (
        <Stack gap="md">
          <Skeleton height="6rem" />
          <Skeleton height="10rem" />
          <Skeleton height="10rem" />
        </Stack>
      ) : null}

      {state.status === "error" ? (
        <ErrorState
          title="Diagnostics unavailable"
          description={state.message}
          action={
            <Button type="button" onClick={() => void load()}>
              Try again
            </Button>
          }
        />
      ) : null}

      {state.status === "ready" ? <DiagnosticsBody data={state.data} /> : null}
    </div>
  );
}

function DiagnosticsBody({ data }: { data: ProviderDiagnosticsResponse }) {
  return (
    <Stack gap="lg">
      <section className="admin-page__section" aria-labelledby="provider-platform-heading">
        <SectionHeader
          id="provider-platform-heading"
          title="Platform"
          description={`Snapshot at ${formatTimestamp(data.generatedAt)}${
            data.cancelled ? " · platform cancelled" : ""
          }`}
        />
        <div className="admin-metrics-grid">
          <MetricCard label="User-Agent" value={data.platform.userAgent} />
          <MetricCard label="Connect timeout" value={`${data.platform.connectTimeoutMs} ms`} />
          <MetricCard label="Request timeout" value={`${data.platform.requestTimeoutMs} ms`} />
          <MetricCard
            label="Max response"
            value={`${Math.round(data.platform.maxResponseBytes / 1024)} KiB`}
          />
          <MetricCard label="Max redirects" value={String(data.platform.maxRedirects)} />
        </div>
      </section>

      <section className="admin-page__section" aria-labelledby="provider-cache-heading">
        <SectionHeader
          id="provider-cache-heading"
          title="Cache metrics"
          description="Stale-while-revalidate and conditional request counters for the provider HTTP cache."
        />
        <div className="admin-metrics-grid">
          <MetricCard label="Hits" value={String(data.cache.hits)} />
          <MetricCard label="Misses" value={String(data.cache.misses)} />
          <MetricCard label="Stale" value={String(data.cache.stales)} />
          <MetricCard label="Bypass" value={String(data.cache.bypasses)} />
          <MetricCard label="Stores" value={String(data.cache.stores)} />
          <MetricCard label="Not modified" value={String(data.cache.notModified)} />
        </div>
      </section>

      <section className="admin-page__section" aria-labelledby="provider-list-heading">
        <SectionHeader
          id="provider-list-heading"
          title="Providers"
          description="Per-provider circuit state, rate-limit budget, and recent timings."
        />
        {data.providers.length === 0 ? (
          <EmptyState
            title="No provider activity yet"
            description="Providers appear here after Dashora makes outbound fetches on their behalf."
          />
        ) : (
          <div className="admin-provider-list">
            {data.providers.map((provider) => (
              <ProviderCard key={provider.id} provider={provider} />
            ))}
          </div>
        )}
      </section>
    </Stack>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="admin-metric-card">
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle as="h3">{value}</CardTitle>
      </CardHeader>
    </Card>
  );
}

function ProviderCard({ provider }: { provider: ProviderDiagnosticsEntry }) {
  return (
    <Card className="admin-provider-card">
      <CardHeader className="admin-provider-card__header">
        <div>
          <CardTitle as="h3">{provider.id}</CardTitle>
          <CardDescription>
            Limit {provider.rateLimit.remaining}/{provider.rateLimit.limit} remaining · window{" "}
            {provider.rateLimit.windowMs} ms
          </CardDescription>
        </div>
        <div className="admin-provider-card__badges">
          <Badge tone={statusTone(provider.status)}>{provider.status}</Badge>
          <Badge tone={circuitTone(provider.circuitState)}>circuit {provider.circuitState}</Badge>
        </div>
      </CardHeader>
      <CardBody>
        <dl className="admin-provider-stats">
          <div>
            <dt>Last success</dt>
            <dd>{formatTimestamp(provider.timings.lastSuccessAt)}</dd>
          </div>
          <div>
            <dt>Last failure</dt>
            <dd>{formatTimestamp(provider.timings.lastFailureAt)}</dd>
          </div>
          <div>
            <dt>Last duration</dt>
            <dd>{formatMs(provider.timings.lastDurationMs)}</dd>
          </div>
          <div>
            <dt>Average duration</dt>
            <dd>{formatMs(provider.timings.averageDurationMs)}</dd>
          </div>
          <div>
            <dt>Requests</dt>
            <dd>{provider.counters.requests}</dd>
          </div>
          <div>
            <dt>Successes</dt>
            <dd>{provider.counters.successes}</dd>
          </div>
          <div>
            <dt>Failures</dt>
            <dd>{provider.counters.failures}</dd>
          </div>
          <div>
            <dt>Rate limited</dt>
            <dd>{provider.counters.rateLimited}</dd>
          </div>
          <div>
            <dt>Circuit rejected</dt>
            <dd>{provider.counters.circuitRejected}</dd>
          </div>
          <div>
            <dt>Deduplicated</dt>
            <dd>{provider.counters.deduplicated}</dd>
          </div>
        </dl>
        {provider.lastError ? (
          <output className="admin-provider-error">
            Last error: {provider.lastError.code} — {provider.lastError.message}
          </output>
        ) : null}
      </CardBody>
    </Card>
  );
}
