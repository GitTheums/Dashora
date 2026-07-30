import { type ReactNode, useCallback, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { useBodyScrollLock } from "./hooks/use-body-scroll-lock.js";
import { useEscapeKey } from "./hooks/use-escape-key.js";
import { useFocusTrap } from "./hooks/use-focus-trap.js";
import { IconButton } from "./icon-button.js";
import { Overlay } from "./overlay.js";
import { cx } from "./utils/cx.js";

function CloseIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M4 4l8 8M12 4L4 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export type DrawerSide = "left" | "right";

export type DrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  title: string;
  description?: string;
  footer?: ReactNode;
  side?: DrawerSide;
};

export function Drawer({
  open,
  onOpenChange,
  children,
  title,
  description,
  footer,
  side = "right",
}: DrawerProps) {
  const titleId = useId();
  const descriptionId = useId();
  const drawerRef = useRef<HTMLDialogElement>(null);
  const close = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  useEscapeKey(open, close);
  useFocusTrap(drawerRef, open);
  useBodyScrollLock(open);

  if (!open || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <>
      <Overlay onClick={close} tabIndex={-1} />
      <dialog
        ref={drawerRef}
        open
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        className={cx("ds-drawer", side === "left" && "ds-drawer--left")}
      >
        <div className="ds-drawer__header">
          <div>
            <h2 id={titleId} className="ds-drawer__title">
              {title}
            </h2>
            {description ? (
              <p id={descriptionId} className="ds-dialog__description">
                {description}
              </p>
            ) : null}
          </div>
          <IconButton label="Close drawer" onClick={close}>
            <CloseIcon />
          </IconButton>
        </div>
        <div className="ds-drawer__body">{children}</div>
        {footer ? <div className="ds-drawer__footer">{footer}</div> : null}
      </dialog>
    </>,
    document.body,
  );
}
