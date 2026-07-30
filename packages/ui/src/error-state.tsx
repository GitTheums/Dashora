import type { HTMLAttributes, ReactNode } from "react";
import { cx } from "./utils/cx.js";

function ErrorIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" width="16" height="16">
      <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 5v3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="8" cy="11" r="0.75" fill="currentColor" />
    </svg>
  );
}

export type ErrorStateProps = HTMLAttributes<HTMLDivElement> & {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
  align?: "start" | "center";
};

export function ErrorState({
  title,
  description,
  action,
  icon,
  align = "start",
  className,
  ...rest
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cx(
        "ds-state",
        "ds-state--error",
        align === "center" && "ds-state--center",
        className,
      )}
      {...rest}
    >
      <span className="ds-state__icon">{icon ?? <ErrorIcon />}</span>
      <h3 className="ds-state__title">{title}</h3>
      {description ? <p className="ds-state__description">{description}</p> : null}
      {action ? <div className="ds-state__actions">{action}</div> : null}
    </div>
  );
}
