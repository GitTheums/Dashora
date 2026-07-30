import { WidgetShell } from "../widget-shell.js";

export function SkeletonPreviewWidget() {
  return (
    <WidgetShell
      title="Inbox"
      description="State preview"
      state="loading"
      variant="utility"
      colSpan={3}
      tabletSpan={4}
      mobileSpan={4}
    />
  );
}

export function EmptyPreviewWidget() {
  return (
    <WidgetShell
      title="Notifications"
      description="State preview"
      state="empty"
      emptyTitle="No notifications"
      emptyDescription="You are all caught up. New alerts will appear here."
      variant="utility"
      colSpan={3}
      tabletSpan={4}
      mobileSpan={4}
    />
  );
}

export function StalePreviewWidget() {
  return (
    <WidgetShell
      title="Transit"
      description="State preview"
      state="stale"
      staleMessage="Last updated 26 minutes ago. Refresh is still running."
      variant="utility"
      colSpan={3}
      tabletSpan={4}
      mobileSpan={4}
    >
      <div className="stale-preview">
        <p className="list-title">Next train to Centraal</p>
        <p className="stale-preview__eta meta-value">6 min</p>
        <p className="list-meta">Platform 4 · delayed by 2 minutes</p>
      </div>
    </WidgetShell>
  );
}

export function ErrorPreviewWidget() {
  return (
    <WidgetShell
      title="Mail"
      description="State preview"
      state="error"
      errorTitle="Mailbox unreachable"
      errorDescription="The mail provider did not respond. Your credentials were not exposed."
      variant="utility"
      colSpan={3}
      tabletSpan={4}
      mobileSpan={4}
    />
  );
}
