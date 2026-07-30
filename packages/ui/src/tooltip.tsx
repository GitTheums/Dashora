import { type FocusEvent, type HTMLAttributes, type ReactNode, useId, useState } from "react";
import { cx } from "./utils/cx.js";

export type TooltipProps = HTMLAttributes<HTMLSpanElement> & {
  children: ReactNode;
  content: ReactNode;
  disabled?: boolean;
};

export function Tooltip({ children, content, className, disabled = false, ...rest }: TooltipProps) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const show = open && !disabled;

  return (
    <span
      className={cx("ds-tooltip-wrap", className)}
      onMouseEnter={() => {
        setOpen(true);
      }}
      onMouseLeave={() => {
        setOpen(false);
      }}
      onFocus={(event: FocusEvent<HTMLSpanElement>) => {
        if (event.currentTarget.contains(event.target)) {
          setOpen(true);
        }
      }}
      onBlur={(event: FocusEvent<HTMLSpanElement>) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setOpen(false);
        }
      }}
      {...rest}
    >
      <span aria-describedby={show ? id : undefined}>{children}</span>
      <span role="tooltip" id={id} className="ds-tooltip" hidden={!show}>
        {content}
      </span>
    </span>
  );
}
