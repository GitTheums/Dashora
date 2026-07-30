import {
  Badge,
  type BadgeTone,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  EmptyState,
  ErrorState,
  IconButton,
  Skeleton,
  Stack,
  cx,
} from "@dashora/ui";
import type { CSSProperties, ReactNode } from "react";
import { MoreIcon, RefreshIcon } from "./icons.js";

export type WidgetRuntimeState =
  | "loading"
  | "empty"
  | "stale"
  | "error"
  | "disabled"
  | "configuration-required"
  | "ready";

export type WidgetSurfaceVariant = "default" | "hero" | "dense" | "media" | "utility";

export type WidgetShellProps = {
  title: string;
  description?: string;
  state?: WidgetRuntimeState;
  variant?: WidgetSurfaceVariant;
  colSpan?: 2 | 3 | 4 | 5 | 6 | 8 | 12;
  tabletSpan?: 2 | 3 | 4 | 5 | 6 | 8;
  mobileSpan?: 2 | 4;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
  staleMessage?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  errorTitle?: string;
  errorDescription?: string;
};

function stateBadge(state: WidgetRuntimeState): { label: string; tone: BadgeTone } | null {
  switch (state) {
    case "stale":
      return { label: "Stale", tone: "warning" };
    case "error":
      return { label: "Error", tone: "danger" };
    case "disabled":
      return { label: "Disabled", tone: "neutral" };
    case "configuration-required":
      return { label: "Setup", tone: "secondary" };
    case "loading":
      return { label: "Loading", tone: "neutral" };
    case "empty":
      return { label: "Empty", tone: "neutral" };
    default:
      return null;
  }
}

function LoadingBody() {
  return (
    <Stack gap="sm" aria-busy="true" aria-live="polite">
      <Skeleton variant="title" width="55%" />
      <Skeleton variant="text" width="90%" />
      <Skeleton variant="text" width="72%" />
      <Skeleton variant="block" height={72} />
    </Stack>
  );
}

export function WidgetShell({
  title,
  description,
  state = "ready",
  variant = "default",
  colSpan = 4,
  tabletSpan,
  mobileSpan = 4,
  actions,
  children,
  className,
  staleMessage = "Showing last good data while a refresh is overdue.",
  emptyTitle = "Nothing here yet",
  emptyDescription = "There is no content to show for this widget.",
  errorTitle = "Could not load data",
  errorDescription = "Something went wrong. Try again in a moment.",
}: WidgetShellProps) {
  const badge = stateBadge(state);
  const resolvedTabletSpan = tabletSpan ?? Math.min(colSpan, 8);
  const isPanelMuted = state === "disabled" || state === "configuration-required";

  let body: ReactNode;
  if (state === "loading") {
    body = <LoadingBody />;
  } else if (state === "empty") {
    body = <EmptyState title={emptyTitle} description={emptyDescription} />;
  } else if (state === "error") {
    body = (
      <ErrorState
        title={errorTitle}
        description={errorDescription}
        action={
          <Button size="sm" variant="secondary">
            Retry
          </Button>
        }
      />
    );
  } else if (state === "disabled") {
    body = (
      <EmptyState
        title="Widget disabled"
        description="Turn this widget on to start showing data."
      />
    );
  } else if (state === "configuration-required") {
    body = (
      <EmptyState
        title="Configuration required"
        description="Add the missing settings before this widget can run."
        action={
          <Button size="sm" variant="secondary">
            Configure
          </Button>
        }
      />
    );
  } else {
    body = (
      <>
        {state === "stale" ? (
          <output className="widget-shell__banner">{staleMessage}</output>
        ) : null}
        {children}
      </>
    );
  }

  return (
    <Card
      className={cx(
        "widget-shell",
        variant !== "default" && `widget-shell--${variant}`,
        isPanelMuted && "widget-shell--muted",
        state === "stale" && "widget-shell--stale",
        className,
      )}
      style={
        {
          "--widget-col": colSpan,
          "--widget-col-tablet": resolvedTabletSpan,
          "--widget-col-mobile": mobileSpan,
        } as CSSProperties
      }
      data-col={colSpan}
      data-col-tablet={resolvedTabletSpan}
      data-col-mobile={mobileSpan}
      data-variant={variant}
    >
      <CardHeader className="widget-shell__header">
        <div className="widget-shell__heading">
          <div className="widget-shell__title-row">
            <CardTitle as="h2">{title}</CardTitle>
            {badge ? <Badge tone={badge.tone}>{badge.label}</Badge> : null}
          </div>
          {description ? <p className="widget-shell__description">{description}</p> : null}
        </div>
        <div className="widget-shell__actions">
          {actions}
          <IconButton label={`Refresh ${title}`} size="sm">
            <RefreshIcon />
          </IconButton>
          <IconButton label={`More actions for ${title}`} size="sm">
            <MoreIcon />
          </IconButton>
        </div>
      </CardHeader>
      <CardBody className="widget-shell__body">{body}</CardBody>
    </Card>
  );
}
