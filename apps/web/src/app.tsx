import type { DashboardApi } from "./dashboard/api.js";
import { DashboardPage } from "./dashboard/dashboard-page.js";

export type AppProps = {
  appName: string;
  dashboardApi?: DashboardApi;
};

export function App({ appName, dashboardApi }: AppProps) {
  return <DashboardPage appName={appName} {...(dashboardApi ? { api: dashboardApi } : {})} />;
}
