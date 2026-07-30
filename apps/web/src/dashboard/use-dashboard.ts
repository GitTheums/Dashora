import type { CreatePageRequest, Dashboard, Page, UpdatePageRequest } from "@dashora/shared";
import { useCallback, useEffect, useRef, useState } from "react";
import type { DashboardApi } from "./api.js";
import { DashboardApiError } from "./api.js";

export type DashboardLoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; dashboard: Dashboard };

export type UseDashboardResult = {
  state: DashboardLoadState;
  busy: boolean;
  notice: string | null;
  clearNotice: () => void;
  reload: () => Promise<void>;
  createPage: (input: CreatePageRequest) => Promise<Page | null>;
  updatePage: (pageId: string, input: UpdatePageRequest) => Promise<Page | null>;
  duplicatePage: (pageId: string) => Promise<Page | null>;
  reorderPages: (orderedIds: string[]) => Promise<boolean>;
  deletePage: (pageId: string) => Promise<boolean>;
};

function messageFromError(error: unknown, fallback: string): string {
  if (error instanceof DashboardApiError) {
    return error.message;
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}

export function useDashboard(api: DashboardApi): UseDashboardResult {
  const [state, setState] = useState<DashboardLoadState>({ status: "loading" });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const snapshotRef = useRef<Dashboard | null>(null);

  const reload = useCallback(async () => {
    setState({ status: "loading" });
    try {
      const dashboard = await api.getDashboard();
      snapshotRef.current = dashboard;
      setState({ status: "ready", dashboard });
    } catch (error) {
      setState({
        status: "error",
        message: messageFromError(error, "Could not load your dashboard."),
      });
    }
  }, [api]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const withOptimistic = useCallback(
    async <T>(
      applyOptimistic: (current: Dashboard) => Dashboard,
      run: () => Promise<T>,
      reconcile?: (result: T, current: Dashboard) => Dashboard,
      failureMessage = "Something went wrong. Changes were reverted.",
    ): Promise<T | null> => {
      const current = snapshotRef.current;
      if (!current) {
        return null;
      }
      const previous = current;
      const optimistic = applyOptimistic(current);
      snapshotRef.current = optimistic;
      setState({ status: "ready", dashboard: optimistic });
      setBusy(true);
      setNotice(null);
      try {
        const result = await run();
        const next = reconcile ? reconcile(result, optimistic) : optimistic;
        // Prefer server truth when available via reload of list fields.
        snapshotRef.current = next;
        setState({ status: "ready", dashboard: next });
        return result;
      } catch (error) {
        snapshotRef.current = previous;
        setState({ status: "ready", dashboard: previous });
        setNotice(messageFromError(error, failureMessage));
        return null;
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  const createPage = useCallback(
    async (input: CreatePageRequest) => {
      setBusy(true);
      setNotice(null);
      try {
        const page = await api.createPage(input);
        const current = snapshotRef.current;
        if (!current) {
          await reload();
          return page;
        }
        const next = {
          ...current,
          pages: [...current.pages, page],
          updatedAt: page.updatedAt,
        };
        snapshotRef.current = next;
        setState({ status: "ready", dashboard: next });
        return page;
      } catch (error) {
        setNotice(messageFromError(error, "Could not create the page."));
        return null;
      } finally {
        setBusy(false);
      }
    },
    [api, reload],
  );

  const updatePage = useCallback(
    async (pageId: string, input: UpdatePageRequest) => {
      return withOptimistic(
        (current) => ({
          ...current,
          pages: current.pages.map((page) =>
            page.id === pageId
              ? {
                  ...page,
                  name: input.name ?? page.name,
                  slug: input.slug ?? page.slug,
                  icon: input.icon ?? page.icon,
                  accent: input.accent !== undefined ? (input.accent ?? null) : page.accent,
                }
              : page,
          ),
        }),
        () => api.updatePage(pageId, input),
        (page, current) => ({
          ...current,
          pages: current.pages.map((candidate) => (candidate.id === page.id ? page : candidate)),
          updatedAt: page.updatedAt,
        }),
        "Could not update the page. Changes were reverted.",
      );
    },
    [api, withOptimistic],
  );

  const duplicatePage = useCallback(
    async (pageId: string) => {
      setBusy(true);
      setNotice(null);
      try {
        const page = await api.duplicatePage(pageId);
        const current = snapshotRef.current;
        if (!current) {
          await reload();
          return page;
        }
        const next = {
          ...current,
          pages: [...current.pages, page],
          updatedAt: page.updatedAt,
        };
        snapshotRef.current = next;
        setState({ status: "ready", dashboard: next });
        return page;
      } catch (error) {
        setNotice(messageFromError(error, "Could not duplicate the page."));
        return null;
      } finally {
        setBusy(false);
      }
    },
    [api, reload],
  );

  const reorderPages = useCallback(
    async (orderedIds: string[]) => {
      const result = await withOptimistic(
        (current) => {
          const byId = new Map(current.pages.map((page) => [page.id, page]));
          return {
            ...current,
            pages: orderedIds.flatMap((id, index) => {
              const page = byId.get(id);
              return page ? [{ ...page, sortOrder: index }] : [];
            }),
          };
        },
        () => api.reorderPages(orderedIds),
        (dashboard) => dashboard,
        "Could not reorder pages. Changes were reverted.",
      );
      return result !== null;
    },
    [api, withOptimistic],
  );

  const deletePage = useCallback(
    async (pageId: string) => {
      const result = await withOptimistic(
        (current) => ({
          ...current,
          pages: current.pages.filter((page) => page.id !== pageId),
        }),
        () => api.deletePage(pageId),
        (_result, current) => current,
        "Could not delete the page. Changes were reverted.",
      );
      return result !== null;
    },
    [api, withOptimistic],
  );

  return {
    state,
    busy,
    notice,
    clearNotice: () => {
      setNotice(null);
    },
    reload,
    createPage,
    updatePage,
    duplicatePage,
    reorderPages,
    deletePage,
  };
}
