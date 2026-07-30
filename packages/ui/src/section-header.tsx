import type { HTMLAttributes, ReactNode } from "react";
import { cx } from "./utils/cx.js";

export type SectionHeaderProps = HTMLAttributes<HTMLElement> & {
  title: string;
  description?: ReactNode;
  eyebrow?: ReactNode;
  actions?: ReactNode;
  as?: "header" | "div";
};

export function SectionHeader({
  title,
  description,
  eyebrow,
  actions,
  as: Tag = "header",
  className,
  ...rest
}: SectionHeaderProps) {
  return (
    <Tag className={cx("ds-section-header", className)} {...rest}>
      <div className="ds-section-header__copy">
        {eyebrow ? <p className="ds-section-header__eyebrow">{eyebrow}</p> : null}
        <h2 className="ds-section-header__title">{title}</h2>
        {description ? <p className="ds-section-header__description">{description}</p> : null}
      </div>
      {actions ? <div className="ds-section-header__actions">{actions}</div> : null}
    </Tag>
  );
}
