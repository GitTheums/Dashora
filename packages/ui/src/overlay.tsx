import type { ButtonHTMLAttributes } from "react";
import { cx } from "./utils/cx.js";

export type OverlayProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type" | "children">;

export function Overlay({ className, ...rest }: OverlayProps) {
  return (
    <button type="button" aria-label="Dismiss" className={cx("ds-overlay", className)} {...rest} />
  );
}
