import type { HTMLAttributes, ReactNode } from "react";
import { cx } from "./utils/cx.js";

export type StackGap = "xs" | "sm" | "md" | "lg" | "xl";

export type StackProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  gap?: StackGap;
};

export function Stack({ children, className, gap = "md", ...rest }: StackProps) {
  return (
    <div className={cx("ds-stack", `ds-stack--gap-${gap}`, className)} {...rest}>
      {children}
    </div>
  );
}
