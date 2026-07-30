import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cx } from "./utils/cx.js";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
};

export function Button({
  children,
  className,
  variant = "primary",
  size = "md",
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cx(
        "ds-button",
        variant !== "primary" && `ds-button--${variant}`,
        size !== "md" && `ds-button--${size}`,
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
