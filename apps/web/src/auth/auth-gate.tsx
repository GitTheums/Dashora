import type { AuthUser, DashboardThemeOverride } from "@dashora/shared";
import { Button, EmptyState, Skeleton, Stack, useTheme } from "@dashora/ui";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ProviderDiagnosticsPage } from "../admin/provider-diagnostics-page.js";
import { App } from "../app.js";
import { type DashboardApi, createDashboardApi } from "../dashboard/api.js";
import { DesignSystemPage } from "../design-system-page.js";
import { AccountPage } from "../settings/account-page.js";
import { type BackupApi, createBackupApi } from "../settings/backup-api.js";
import { BackupPage } from "../settings/backup-page.js";
import {
  SETTINGS_APPEARANCE_PATH,
  consumePathAfterLogin,
  isAccountSettingsPath,
  isAppearanceSettingsPath,
  isBackupSettingsPath,
  isSettingsPath,
  settingsAppearanceHref,
  stashPathAfterLogin,
} from "../settings/paths.js";
import { readReturnToFromSearch } from "../settings/return-to.js";
import { SettingsShell } from "../settings/settings-shell.js";
import { createThemeApi } from "../theme/api.js";
import { type AppearanceLeaveController, AppearancePage } from "../theme/appearance-page.js";
import { useThemeBootstrap } from "../theme/use-theme-bootstrap.js";
import { type AuthApi, AuthApiError, createAuthApi } from "./api.js";
import { AuthShell } from "./auth-shell.js";
import { LoginPage } from "./login-page.js";
import { getPath, getPathWithSearch, navigate, readSetupTokenFromLocation } from "./routing.js";
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
      if (isSettingsPath(path)) {
        stashPathAfterLogin(getPathWithSearch());
      }
      navigate("/login");
    }
    if (phase.kind === "authenticated" && (path === "/login" || path === "/setup")) {
      const restored = consumePathAfterLogin();
      navigate(restored && restored.length > 0 ? restored : "/");
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

  return (
    <AuthenticatedApp
      appName={appName}
      user={phase.user}
      api={api}
      apiBaseUrl={apiBaseUrl}
      path={path}
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
  path: string;
  dashboardApi?: DashboardApi;
  onSignedOut: () => void;
};

function AuthenticatedApp({
  appName,
  user,
  api,
  apiBaseUrl,
  path,
  dashboardApi: dashboardApiOverride,
  onSignedOut,
}: AuthenticatedAppProps) {
  const dashboardApi = useMemo(
    () => dashboardApiOverride ?? createDashboardApi(apiBaseUrl),
    [apiBaseUrl, dashboardApiOverride],
  );
  const themeApi = useMemo(() => createThemeApi(apiBaseUrl), [apiBaseUrl]);
  const backupApi: BackupApi = useMemo(() => createBackupApi(apiBaseUrl), [apiBaseUrl]);
  const { ready: themeReady } = useThemeBootstrap(themeApi);
  const { setDashboardOverride } = useTheme();
  const [dashboardThemeOverride, setDashboardThemeOverride] =
    useState<DashboardThemeOverride | null>(null);
  const appearanceLeaveRef = useRef<AppearanceLeaveController | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const dashboard = await dashboardApi.getDashboard();
        if (!cancelled) {
          setDashboardThemeOverride(dashboard.themeOverride);
          setDashboardOverride(dashboard.themeOverride);
        }
      } catch {
        // Dashboard load failures are handled by the dashboard page itself.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dashboardApi, setDashboardOverride]);

  const signOut = useCallback(() => {
    void (async () => {
      try {
        await api.logout();
      } finally {
        onSignedOut();
      }
    })();
  }, [api, onSignedOut]);

  useEffect(() => {
    if (path === "/settings") {
      const returnTo = readReturnToFromSearch();
      navigate(settingsAppearanceHref(returnTo === "/" ? null : returnTo));
    } else if (
      isSettingsPath(path) &&
      !isAppearanceSettingsPath(path) &&
      !isAccountSettingsPath(path) &&
      !isBackupSettingsPath(path)
    ) {
      navigate(SETTINGS_APPEARANCE_PATH);
    }
  }, [path]);

  if (!themeReady) {
    return (
      <AuthShell title="Loading appearance" lede="Applying your saved theme preferences…">
        <Stack gap="md">
          <Skeleton height="2.75rem" />
          <Skeleton height="2.75rem" />
        </Stack>
      </AuthShell>
    );
  }

  if (path === "/design-system") {
    return <DesignSystemPage />;
  }

  if (path === "/admin/providers") {
    return <ProviderDiagnosticsPage apiBaseUrl={apiBaseUrl} />;
  }

  if (
    isAppearanceSettingsPath(path) ||
    isAccountSettingsPath(path) ||
    isBackupSettingsPath(path) ||
    path === "/settings"
  ) {
    const returnTo = readReturnToFromSearch();
    const requestLeave = (destination: string) => {
      if (appearanceLeaveRef.current) {
        appearanceLeaveRef.current.requestLeave(destination);
        return;
      }
      navigate(destination);
    };
    const activeSection = isAccountSettingsPath(path)
      ? "account"
      : isBackupSettingsPath(path)
        ? "backup"
        : "appearance";
    return (
      <SettingsShell
        activeSection={activeSection}
        returnTo={returnTo}
        onBack={() => {
          requestLeave(returnTo);
        }}
        onNavigateHome={() => {
          requestLeave(returnTo);
        }}
      >
        {activeSection === "account" ? (
          <AccountPage user={user} onSignOut={signOut} />
        ) : activeSection === "backup" ? (
          <BackupPage api={backupApi} />
        ) : (
          <AppearancePage
            api={themeApi}
            dashboardOverride={dashboardThemeOverride}
            onDashboardOverrideChange={(override) => {
              setDashboardThemeOverride(override);
              setDashboardOverride(override);
            }}
            envAppName={appName}
            leaveControllerRef={appearanceLeaveRef}
            onRequestLeave={(destination) => {
              navigate(destination);
            }}
          />
        )}
      </SettingsShell>
    );
  }

  return <App appName={appName} dashboardApi={dashboardApi} />;
}
