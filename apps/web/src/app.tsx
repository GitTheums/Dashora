import type { DashboardApi } from "./dashboard/api.js";
import { DashboardPage } from "./dashboard/dashboard-page.js";

export type AppSession = {
  displayName: string;
  onSignOut: () => void;
};

export type AppProps = {
  appName: string;
  session?: AppSession;
  dashboardApi?: DashboardApi;
};

export function App({ appName, session, dashboardApi }: AppProps) {
  return (
    <DashboardPage
      appName={appName}
      {...(session ? { session } : {})}
      {...(dashboardApi ? { api: dashboardApi } : {})}
    />
  );
}
