import {
  type KeyboardEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { useBodyScrollLock } from "./hooks/use-body-scroll-lock.js";
import { useEscapeKey } from "./hooks/use-escape-key.js";
import { useFocusTrap } from "./hooks/use-focus-trap.js";
import { Overlay } from "./overlay.js";
import { cx } from "./utils/cx.js";

export type CommandMenuItem = {
  id: string;
  label: string;
  group?: string;
  shortcut?: string;
  disabled?: boolean;
  onSelect?: () => void;
};

export type CommandMenuProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: CommandMenuItem[];
  placeholder?: string;
  emptyMessage?: string;
};

export function CommandMenu({
  open,
  onOpenChange,
  items,
  placeholder = "Search commands…",
  emptyMessage = "No matching commands",
}: CommandMenuProps) {
  const labelId = useId();
  const rootRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const close = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  useEscapeKey(open, close);
  useFocusTrap(rootRef, open);
  useBodyScrollLock(open);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setActiveIndex(0);
      return;
    }
    const frame = window.requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [open]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return items;
    }
    return items.filter((item) => item.label.toLowerCase().includes(normalized));
  }, [items, query]);

  const runItem = useCallback(
    (item: CommandMenuItem) => {
      if (item.disabled) {
        return;
      }
      item.onSelect?.();
      close();
    },
    [close],
  );

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDialogElement>) => {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveIndex((index) => (filtered.length === 0 ? 0 : (index + 1) % filtered.length));
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex((index) =>
          filtered.length === 0 ? 0 : (index - 1 + filtered.length) % filtered.length,
        );
      } else if (event.key === "Enter") {
        const item = filtered[activeIndex];
        if (item) {
          event.preventDefault();
          runItem(item);
        }
      }
    },
    [activeIndex, filtered, runItem],
  );

  const groups = useMemo(() => {
    const map = new Map<string, Array<CommandMenuItem & { flatIndex: number }>>();
    let flatIndex = 0;
    for (const item of filtered) {
      const key = item.group ?? "Commands";
      const list = map.get(key) ?? [];
      list.push({ ...item, flatIndex });
      map.set(key, list);
      flatIndex += 1;
    }
    return map;
  }, [filtered]);

  if (!open || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <>
      <Overlay onClick={close} tabIndex={-1} />
      <dialog
        ref={rootRef}
        open
        aria-labelledby={labelId}
        className="ds-command"
        onKeyDown={onKeyDown}
      >
        <div className="ds-command__search">
          <label id={labelId} className="visually-hidden" htmlFor={`${labelId}-input`}>
            Command menu
          </label>
          <input
            ref={inputRef}
            id={`${labelId}-input`}
            className="ds-command__input"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActiveIndex(0);
            }}
            placeholder={placeholder}
            autoComplete="off"
            spellCheck={false}
          />
          <kbd className="ds-command__kbd">esc</kbd>
        </div>
        <div className="ds-command__list">
          {filtered.length === 0 ? (
            <div className="ds-command__empty">{emptyMessage}</div>
          ) : (
            Array.from(groups.entries()).map(([group, groupItems]) => (
              <div key={group}>
                <div className="ds-command__group-label">{group}</div>
                {groupItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    data-active={item.flatIndex === activeIndex ? "true" : "false"}
                    disabled={item.disabled}
                    className={cx("ds-command__item")}
                    onMouseEnter={() => {
                      setActiveIndex(item.flatIndex);
                    }}
                    onClick={() => {
                      runItem(item);
                    }}
                  >
                    <span>{item.label}</span>
                    {item.shortcut ? (
                      <span className="ds-command__shortcut">{item.shortcut}</span>
                    ) : null}
                  </button>
                ))}
              </div>
            ))
          )}
        </div>
      </dialog>
    </>,
    document.body,
  );
}
