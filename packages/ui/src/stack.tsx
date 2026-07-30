import type { HTMLAttributes, ReactNode } from "react";

export type StackProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  gap?: "sm" | "md" | "lg";
};

export function Stack({ children, className, gap = "md", ...rest }: StackProps) {
  const classes = `dashora-stack dashora-stack--gap-${gap}${className ? ` ${className}` : ""}`;

  return (
    <div className={classes} {...rest}>
      {children}
    </div>
  );
}
