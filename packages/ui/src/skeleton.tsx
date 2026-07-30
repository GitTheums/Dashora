import type { HTMLAttributes } from "react";
import { cx } from "./utils/cx.js";

export type SkeletonVariant = "text" | "title" | "avatar" | "block";

export type SkeletonProps = HTMLAttributes<HTMLDivElement> & {
  variant?: SkeletonVariant;
  width?: string | number;
  height?: string | number;
};

export function Skeleton({
  className,
  variant = "text",
  width,
  height,
  style,
  ...rest
}: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={cx("ds-skeleton", `ds-skeleton--${variant}`, className)}
      style={{
        ...style,
        ...(width !== undefined ? { width } : {}),
        ...(height !== undefined ? { height } : {}),
      }}
      {...rest}
    />
  );
}
