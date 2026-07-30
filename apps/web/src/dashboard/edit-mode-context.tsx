import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";

export type EnterEditModeOptions = {
  /** Open this widget's settings drawer after entering Edit mode. */
  configureWidgetId?: string;
};

type BeforeExitHandler = () => boolean | Promise<boolean>;

export type DashboardEditModeContextValue = {
  editMode: boolean;
  /** Enter Edit mode. Remains active across in-dashboard page navigation. */
  enterEditMode: (options?: EnterEditModeOptions) => void;
  /**
   * Leave Edit mode after running registered before-exit handlers
   * (close catalog/settings with unsaved warnings). Escape does not exit Edit mode.
   */
  requestExitEditMode: () => Promise<void>;
  /** Widget id queued to open settings once Edit mode is active. */
  pendingConfigureWidgetId: string | null;
  clearPendingConfigureWidgetId: () => void;
  /** Layout engine registers overlay cleanup / dirty checks. */
  registerBeforeExit: (handler: BeforeExitHandler) => () => void;
  /** Polite live-region text for mode changes. */
  modeAnnouncement: string;
};

const DashboardEditModeContext = createContext<DashboardEditModeContextValue | null>(null);

export type DashboardEditModeProviderProps = {
  children: ReactNode;
  /** Test/harness override. Production always starts in View mode. */
  initialEditMode?: boolean;
};

/**
 * Authoritative Edit mode for the dashboard shell.
 * - Persists across page switches within the same mounted dashboard.
 * - Resets on full reload (React state) and when the provider unmounts (logout).
 * - Not a security boundary; API auth remains server-side.
 * - Escape closes menus/drawers but does not exit Edit mode.
 */
export function DashboardEditModeProvider({
  children,
  initialEditMode = false,
}: DashboardEditModeProviderProps) {
  const [editMode, setEditMode] = useState(initialEditMode);
  const [pendingConfigureWidgetId, setPendingConfigureWidgetId] = useState<string | null>(null);
  const [modeAnnouncement, setModeAnnouncement] = useState("");
  const beforeExitHandlersRef = useRef(new Set<BeforeExitHandler>());

  const registerBeforeExit = useCallback((handler: BeforeExitHandler) => {
    beforeExitHandlersRef.current.add(handler);
    return () => {
      beforeExitHandlersRef.current.delete(handler);
    };
  }, []);

  const enterEditMode = useCallback((options?: EnterEditModeOptions) => {
    if (options?.configureWidgetId) {
      setPendingConfigureWidgetId(options.configureWidgetId);
    }
    setEditMode((previous) => {
      if (!previous) {
        setModeAnnouncement("Dashboard edit mode enabled.");
      }
      return true;
    });
  }, []);

  const clearPendingConfigureWidgetId = useCallback(() => {
    setPendingConfigureWidgetId(null);
  }, []);

  const requestExitEditMode = useCallback(async () => {
    for (const handler of beforeExitHandlersRef.current) {
      const allowed = await handler();
      if (!allowed) {
        return;
      }
    }
    setPendingConfigureWidgetId(null);
    setEditMode((previous) => {
      if (previous) {
        setModeAnnouncement("Dashboard edit mode disabled.");
      }
      return false;
    });
  }, []);

  const value = useMemo(
    () => ({
      editMode,
      enterEditMode,
      requestExitEditMode,
      pendingConfigureWidgetId,
      clearPendingConfigureWidgetId,
      registerBeforeExit,
      modeAnnouncement,
    }),
    [
      clearPendingConfigureWidgetId,
      editMode,
      enterEditMode,
      modeAnnouncement,
      pendingConfigureWidgetId,
      registerBeforeExit,
      requestExitEditMode,
    ],
  );

  return (
    <DashboardEditModeContext.Provider value={value}>{children}</DashboardEditModeContext.Provider>
  );
}

export function useDashboardEditMode(): DashboardEditModeContextValue {
  const context = useContext(DashboardEditModeContext);
  if (!context) {
    throw new Error("useDashboardEditMode must be used within DashboardEditModeProvider");
  }
  return context;
}
