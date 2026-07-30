import {
  type HTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useId,
  useMemo,
} from "react";
import { useControllableState } from "./hooks/use-controllable-state.js";
import { cx } from "./utils/cx.js";

type TabsContextValue = {
  value: string;
  setValue: (value: string) => void;
  baseId: string;
};

const TabsContext = createContext<TabsContextValue | null>(null);

function useTabsContext(): TabsContextValue {
  const context = useContext(TabsContext);
  if (!context) {
    throw new Error("Tabs components must be used within Tabs");
  }
  return context;
}

export type TabsProps = Omit<HTMLAttributes<HTMLDivElement>, "defaultValue"> & {
  children: ReactNode;
  value?: string;
  defaultValue: string;
  onValueChange?: (value: string) => void;
};

export function Tabs({
  children,
  className,
  value,
  defaultValue,
  onValueChange,
  ...rest
}: TabsProps) {
  const baseId = useId();
  const [current, setValue] = useControllableState({
    value,
    defaultValue,
    onChange: onValueChange,
  });

  const context = useMemo(
    () => ({ value: current, setValue, baseId }),
    [current, setValue, baseId],
  );

  return (
    <TabsContext.Provider value={context}>
      <div className={cx("ds-tabs", className)} {...rest}>
        {children}
      </div>
    </TabsContext.Provider>
  );
}

export type TabsListProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
};

export function TabsList({ children, className, ...rest }: TabsListProps) {
  const onKeyDown = useCallback((event: KeyboardEvent<HTMLDivElement>) => {
    const triggers = Array.from(
      event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]:not([disabled])'),
    );
    const index = triggers.indexOf(document.activeElement as HTMLButtonElement);
    if (index < 0) {
      return;
    }

    let next = index;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      next = (index + 1) % triggers.length;
      event.preventDefault();
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      next = (index - 1 + triggers.length) % triggers.length;
      event.preventDefault();
    } else if (event.key === "Home") {
      next = 0;
      event.preventDefault();
    } else if (event.key === "End") {
      next = triggers.length - 1;
      event.preventDefault();
    } else {
      return;
    }

    triggers[next]?.focus();
    triggers[next]?.click();
  }, []);

  return (
    <div role="tablist" className={cx("ds-tabs__list", className)} onKeyDown={onKeyDown} {...rest}>
      {children}
    </div>
  );
}

export type TabsTriggerProps = HTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  value: string;
  disabled?: boolean;
};

export function TabsTrigger({
  children,
  className,
  value,
  disabled = false,
  ...rest
}: TabsTriggerProps) {
  const { value: current, setValue, baseId } = useTabsContext();
  const selected = current === value;

  return (
    <button
      type="button"
      role="tab"
      id={`${baseId}-tab-${value}`}
      aria-controls={`${baseId}-panel-${value}`}
      aria-selected={selected}
      tabIndex={selected ? 0 : -1}
      disabled={disabled}
      className={cx("ds-tabs__trigger", className)}
      onClick={() => {
        setValue(value);
      }}
      {...rest}
    >
      {children}
    </button>
  );
}

export type TabsPanelProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  value: string;
};

export function TabsPanel({ children, className, value, ...rest }: TabsPanelProps) {
  const { value: current, baseId } = useTabsContext();
  if (current !== value) {
    return null;
  }

  return (
    <div
      role="tabpanel"
      id={`${baseId}-panel-${value}`}
      aria-labelledby={`${baseId}-tab-${value}`}
      className={cx("ds-tabs__panel", className)}
      {...rest}
    >
      {children}
    </div>
  );
}
