import type { AuthUser } from "@dashora/shared";
import { Button, EmptyState, Skeleton, Stack } from "@dashora/ui";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ProviderDiagnosticsPage } from "../admin/provider-diagnostics-page.js";
import { App } from "../app.js";
import { type DashboardApi, createDashboardApi } from "../dashboard/api.js";
import { DesignSystemPage } from "../design-system-page.js";
import { type AuthApi, AuthApiError, createAuthApi } from "./api.js";
import { AuthShell } from "./auth-shell.js";
import { LoginPage } from "./login-page.js";
import { getPath, navigate, readSetupTokenFromLocation } from "./routing.js";
import { SetupPage } from "./setup-page.js";

export type AuthGateProps = {
  appName: string;
  apiBaseUrl: string;
  api?: AuthApi;
  dashboardApi?: DashboardApi;
};

type AuthPhase =
  | { kind: "loading" }
  | { kind: "unreachable"; message: string }
  | { kind: "setup"; token: string | null }
  | { kind: "signed-out"; notice: string | null }
  | { kind: "authenticated"; user: AuthUser };

export function AuthGate({
  appName,
  apiBaseUrl,
  api: apiOverride,
  dashboardApi: dashboardApiOverride,
}: AuthGateProps) {
  const api = useMemo(() => apiOverride ?? createAuthApi(apiBaseUrl), [apiBaseUrl, apiOverride]);
  const [path, setPath] = useState(() => getPath());
  const [phase, setPhase] = useState<AuthPhase>({ kind: "loading" });

  useEffect(() => {
    const onPopState = () => {
      setPath(getPath());
    };
    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("popstate", onPopState);
    };
  }, []);

  const refresh = useCallback(async () => {
    setPhase({ kind: "loading" });
    try {
      const status = await api.getStatus();
      if (status.setupRequired) {
        setPhase({ kind: "setup", token: readSetupTokenFromLocation() });
        return;
      }
      const user = await api.getMe();
      if (user) {
        setPhase({ kind: "authenticated", user });
        return;
      }
      setPhase({ kind: "signed-out", notice: null });
    } catch (error) {
      const message =
        error instanceof AuthApiError
          ? error.message
          : "Dashora could not reach the API. Start the server and refresh.";
      setPhase({ kind: "unreachable", message });
    }
  }, [api]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (phase.kind === "setup" && path !== "/setup") {
      navigate("/setup");
    }
    if (phase.kind === "signed-out" && path === "/setup") {
      navigate("/login");
    }
    if (phase.kind === "signed-out" && path !== "/login" && path !== "/setup") {
      navigate("/login");
    }
    if (phase.kind === "authenticated" && (path === "/login" || path === "/setup")) {
      navigate("/");
    }
  }, [phase, path]);

  if (phase.kind === "loading") {
    return (
      <AuthShell title="Checking session" lede="Confirming local authentication state…">
        <Stack gap="md">
          <Skeleton height="2.75rem" />
          <Skeleton height="2.75rem" />
          <Skeleton height="2.5rem" width="40%" />
        </Stack>
      </AuthShell>
    );
  }

  if (phase.kind === "unreachable") {
    return (
      <AuthShell title="Server unreachable" lede={phase.message}>
        <EmptyState
          title="Signed out"
          description="Dashora keeps sessions on the server. Once the API is available, you can sign in or finish first-run setup."
          action={
            <Button type="button" onClick={() => void refresh()}>
              Try again
            </Button>
          }
        />
      </AuthShell>
    );
  }

  if (phase.kind === "setup") {
    return (
      <SetupPage
        api={api}
        token={phase.token ?? readSetupTokenFromLocation()}
        onAuthenticated={() => {
          void refresh();
        }}
      />
    );
  }

  if (phase.kind === "signed-out") {
    return (
      <LoginPage
        api={api}
        notice={phase.notice}
        onAuthenticated={() => {
          void refresh();
        }}
      />
    );
  }

  // Authenticated
  if (path === "/design-system") {
    return <DesignSystemPage />;
  }

  if (path === "/admin/providers") {
    return <ProviderDiagnosticsPage apiBaseUrl={apiBaseUrl} />;
  }

  return (
    <AuthenticatedApp
      appName={appName}
      user={phase.user}
      api={api}
      apiBaseUrl={apiBaseUrl}
      {...(dashboardApiOverride ? { dashboardApi: dashboardApiOverride } : {})}
      onSignedOut={() => {
        setPhase({ kind: "signed-out", notice: "You have been signed out." });
        navigate("/login");
      }}
    />
  );
}

type AuthenticatedAppProps = {
  appName: string;
  user: AuthUser;
  api: AuthApi;
  apiBaseUrl: string;
  dashboardApi?: DashboardApi;
  onSignedOut: () => void;
};

function AuthenticatedApp({
  appName,
  user,
  api,
  apiBaseUrl,
  dashboardApi: dashboardApiOverride,
  onSignedOut,
}: AuthenticatedAppProps) {
  const dashboardApi = useMemo(
    () => dashboardApiOverride ?? createDashboardApi(apiBaseUrl),
    [apiBaseUrl, dashboardApiOverride],
  );

  return (
    <App
      appName={appName}
      dashboardApi={dashboardApi}
      session={{
        displayName: user.displayName,
        onSignOut: () => {
          void (async () => {
            try {
              await api.logout();
            } finally {
              onSignedOut();
            }
          })();
        },
      }}
    />
  );
}
