import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: "primary" | "secondary";
};

export function Button({
  children,
  className,
  variant = "primary",
  type = "button",
  ...rest
}: ButtonProps) {
  const variantClass = variant === "secondary" ? " dashora-button--secondary" : "";
  const classes = `dashora-button${variantClass}${className ? ` ${className}` : ""}`;

  return (
    <button type={type} className={classes} {...rest}>
      {children}
    </button>
  );
}
