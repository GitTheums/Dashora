import { type ButtonHTMLAttributes, type ReactNode, forwardRef } from "react";
import { cx } from "./utils/cx.js";

export type IconButtonSize = "sm" | "md" | "lg";
export type IconButtonVariant = "ghost" | "solid";

export type IconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  label: string;
  children: ReactNode;
  size?: IconButtonSize;
  variant?: IconButtonVariant;
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, children, className, size = "md", variant = "ghost", type = "button", ...rest },
  ref,
) {
  const { title, ...buttonRest } = rest;

  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={title ?? label}
      className={cx(
        "ds-icon-button",
        size !== "md" && `ds-icon-button--${size}`,
        variant === "solid" && "ds-icon-button--solid",
        className,
      )}
      {...buttonRest}
    >
      <span className="ds-icon-button__glyph" aria-hidden="true">
        {children}
      </span>
    </button>
  );
});
