import {
  type CSSProperties,
  Children,
  type HTMLAttributes,
  type MouseEvent,
  type ReactElement,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type Ref,
  cloneElement,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { useEscapeKey } from "./hooks/use-escape-key.js";
import { cx } from "./utils/cx.js";

type DropdownContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
  menuId: string;
  triggerRef: React.RefObject<HTMLElement | null>;
  registerTrigger: (node: HTMLElement | null) => void;
};

const DropdownContext = createContext<DropdownContextValue | null>(null);

function useDropdownContext(): DropdownContextValue {
  const context = useContext(DropdownContext);
  if (!context) {
    throw new Error("DropdownMenu components must be used within DropdownMenu");
  }
  return context;
}

function assignRef<T>(ref: Ref<T> | undefined, value: T | null): void {
  if (!ref) {
    return;
  }
  if (typeof ref === "function") {
    ref(value);
    return;
  }
  (ref as { current: T | null }).current = value;
}

export type DropdownMenuProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
};

export function DropdownMenu({ children, className, ...rest }: DropdownMenuProps) {
  const menuId = useId();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  const registerTrigger = useCallback((node: HTMLElement | null) => {
    triggerRef.current = node;
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    const trigger = triggerRef.current;
    if (trigger) {
      window.requestAnimationFrame(() => {
        trigger.focus();
      });
    }
  }, []);

  useEscapeKey(open, close);

  useEffect(() => {
    if (!open) {
      return;
    }

    const onPointerDown = (event: globalThis.MouseEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target)) {
        return;
      }
      const menu = document.getElementById(menuId);
      if (menu?.contains(target)) {
        return;
      }
      close();
    };

    document.addEventListener("mousedown", onPointerDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [close, menuId, open]);

  const value = useMemo(
    () => ({ open, setOpen, menuId, triggerRef, registerTrigger }),
    [open, menuId, registerTrigger],
  );

  return (
    <DropdownContext.Provider value={value}>
      <div ref={rootRef} className={cx("ds-dropdown", className)} {...rest}>
        {children}
      </div>
    </DropdownContext.Provider>
  );
}

type TriggerElementProps = {
  onClick?: (event: MouseEvent) => void;
  ref?: Ref<HTMLElement>;
  "aria-expanded"?: boolean;
  "aria-haspopup"?: boolean | "menu";
  "aria-controls"?: string;
};

export type DropdownMenuTriggerProps = {
  children: ReactElement<TriggerElementProps>;
};

export function DropdownMenuTrigger({ children }: DropdownMenuTriggerProps) {
  const { open, setOpen, menuId, registerTrigger } = useDropdownContext();
  const child = Children.only(children);

  return cloneElement(child, {
    ref: (node: HTMLElement | null) => {
      registerTrigger(node);
      assignRef(child.props.ref, node);
    },
    "aria-expanded": open,
    "aria-haspopup": "menu" as const,
    "aria-controls": menuId,
    onClick: (event: MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      child.props.onClick?.(event);
      setOpen(!open);
    },
  });
}

export type DropdownMenuContentProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  align?: "start" | "end";
};

export function DropdownMenuContent({
  children,
  className,
  align = "start",
  style,
  ...rest
}: DropdownMenuContentProps) {
  const { open, setOpen, menuId, triggerRef } = useDropdownContext();
  const menuRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ top: number; left: number; minWidth: number } | null>(
    null,
  );

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) {
      return;
    }
    const rect = trigger.getBoundingClientRect();
    const menuWidth = menuRef.current?.offsetWidth ?? 176;
    let left = align === "end" ? rect.right - menuWidth : rect.left;
    left = Math.max(8, Math.min(left, window.innerWidth - menuWidth - 8));
    const top = rect.bottom + 6;
    setCoords({
      top,
      left,
      minWidth: Math.max(rect.width, 11 * 16),
    });
  }, [align, triggerRef]);

  useLayoutEffect(() => {
    if (!open) {
      setCoords(null);
      return;
    }
    updatePosition();
    const frame = window.requestAnimationFrame(() => {
      updatePosition();
      const firstItem = menuRef.current?.querySelector<HTMLButtonElement>(
        '[role="menuitem"]:not(:disabled)',
      );
      firstItem?.focus();
    });
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, updatePosition]);

  const onKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      const items = Array.from(
        menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') ??
          [],
      );
      if (items.length === 0) {
        return;
      }
      const active = document.activeElement;
      const index = items.findIndex((item) => item === active);
      if (event.key === "ArrowDown") {
        event.preventDefault();
        const next = items[(index + 1 + items.length) % items.length];
        next?.focus();
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        const next = items[(index - 1 + items.length) % items.length];
        next?.focus();
      } else if (event.key === "Home") {
        event.preventDefault();
        items[0]?.focus();
      } else if (event.key === "End") {
        event.preventDefault();
        items[items.length - 1]?.focus();
      } else if (event.key === "Tab") {
        setOpen(false);
      }
    },
    [setOpen],
  );

  if (!open || typeof document === "undefined") {
    return null;
  }

  const menuStyle: CSSProperties = {
    ...style,
    position: "fixed",
    top: coords?.top ?? 0,
    left: coords?.left ?? 0,
    minWidth: coords?.minWidth,
    zIndex: "var(--ds-z-dropdown)",
    visibility: coords ? "visible" : "hidden",
  };

  return createPortal(
    <div
      ref={menuRef}
      id={menuId}
      role="menu"
      className={cx("ds-dropdown__menu", "ds-dropdown__menu--portal", className)}
      style={menuStyle}
      onKeyDown={onKeyDown}
      {...rest}
    >
      {children}
    </div>,
    document.body,
  );
}

export type DropdownMenuItemProps = HTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  danger?: boolean;
  disabled?: boolean;
  onSelect?: () => void;
};

export function DropdownMenuItem({
  children,
  className,
  danger = false,
  disabled = false,
  onSelect,
  ...rest
}: DropdownMenuItemProps) {
  const { setOpen, triggerRef } = useDropdownContext();

  const onClick = useCallback(() => {
    if (disabled) {
      return;
    }
    onSelect?.();
    setOpen(false);
    const trigger = triggerRef.current;
    if (trigger) {
      window.requestAnimationFrame(() => {
        trigger.focus();
      });
    }
  }, [disabled, onSelect, setOpen, triggerRef]);

  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      className={cx("ds-dropdown__item", danger && "ds-dropdown__item--danger", className)}
      onClick={onClick}
      {...rest}
    >
      {children}
    </button>
  );
}

export function DropdownMenuSeparator({ className, ...rest }: HTMLAttributes<HTMLHRElement>) {
  return <hr className={cx("ds-dropdown__separator", className)} {...rest} />;
}
