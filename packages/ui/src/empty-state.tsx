import type { HTMLAttributes, ReactNode } from "react";
import { cx } from "./utils/cx.js";

function EmptyIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" width="16" height="16">
      <rect
        x="2.5"
        y="3.5"
        width="11"
        height="9"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path d="M5 8h6M5 10.5h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export type EmptyStateProps = HTMLAttributes<HTMLDivElement> & {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
  align?: "start" | "center";
};

export function EmptyState({
  title,
  description,
  action,
  icon,
  align = "start",
  className,
  ...rest
}: EmptyStateProps) {
  return (
    <div className={cx("ds-state", align === "center" && "ds-state--center", className)} {...rest}>
      <span className="ds-state__icon">{icon ?? <EmptyIcon />}</span>
      <h3 className="ds-state__title">{title}</h3>
      {description ? <p className="ds-state__description">{description}</p> : null}
      {action ? <div className="ds-state__actions">{action}</div> : null}
    </div>
  );
}
