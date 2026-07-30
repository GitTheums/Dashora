import type { HTMLAttributes, ReactNode } from "react";
import { cx } from "./utils/cx.js";

export type BadgeTone = "neutral" | "primary" | "secondary" | "success" | "warning" | "danger";

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  children: ReactNode;
  tone?: BadgeTone;
};

export function Badge({ children, className, tone = "neutral", ...rest }: BadgeProps) {
  return (
    <span className={cx("ds-badge", `ds-badge--${tone}`, className)} {...rest}>
      {children}
    </span>
  );
}
