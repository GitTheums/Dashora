import type { HTMLAttributes, ReactNode } from "react";
import { cx } from "./utils/cx.js";

export type CardProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  elevated?: boolean;
  interactive?: boolean;
};

export function Card({
  children,
  className,
  elevated = false,
  interactive = false,
  ...rest
}: CardProps) {
  return (
    <div
      className={cx(
        "ds-card",
        elevated && "ds-card--elevated",
        interactive && "ds-card--interactive",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

export type CardHeaderProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
};

export function CardHeader({ children, className, ...rest }: CardHeaderProps) {
  return (
    <div className={cx("ds-card__header", className)} {...rest}>
      {children}
    </div>
  );
}

export type CardTitleProps = HTMLAttributes<HTMLHeadingElement> & {
  children: ReactNode;
  as?: "h2" | "h3" | "h4";
};

export function CardTitle({ children, className, as: Tag = "h3", ...rest }: CardTitleProps) {
  return (
    <Tag className={cx("ds-card__title", className)} {...rest}>
      {children}
    </Tag>
  );
}

export type CardDescriptionProps = HTMLAttributes<HTMLParagraphElement> & {
  children: ReactNode;
};

export function CardDescription({ children, className, ...rest }: CardDescriptionProps) {
  return (
    <p className={cx("ds-card__description", className)} {...rest}>
      {children}
    </p>
  );
}

export type CardBodyProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
};

export function CardBody({ children, className, ...rest }: CardBodyProps) {
  return (
    <div className={cx("ds-card__body", className)} {...rest}>
      {children}
    </div>
  );
}

export type CardFooterProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
};

export function CardFooter({ children, className, ...rest }: CardFooterProps) {
  return (
    <div className={cx("ds-card__footer", className)} {...rest}>
      {children}
    </div>
  );
}
