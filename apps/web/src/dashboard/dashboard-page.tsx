import type { CreatePageRequest, Page, UpdatePageRequest } from "@dashora/shared";
import { Button, EmptyState, ErrorState, Skeleton, Stack } from "@dashora/ui";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getPath, navigate } from "../auth/routing.js";
import { isSettingsPath } from "../settings/paths.js";
import type { DashboardApi } from "./api.js";
import { DashboardEditModeProvider, useDashboardEditMode } from "./edit-mode-context.js";
import { DashboardLayoutEngine } from "./layout/dashboard-layout-engine.js";
import { createMemoryDashboardApi } from "./memory-api.js";
import { ConfirmDeletePageDialog, PageEditorDialog } from "./page-dialogs.js";
import { pagePath, readPageSlugFromPath } from "./page-routing.js";
import { TopNav } from "./top-nav.js";
import { useDashboard } from "./use-dashboard.js";

export type DashboardPageProps = {
  appName: string;
  api?: DashboardApi;
};

type EditorState =
  | { open: false }
  | { open: true; mode: "create" }
  | { open: true; mode: "edit"; page: Page };

export function DashboardPage({ appName, api: apiProp }: DashboardPageProps) {
  const api = useMemo(() => apiProp ?? createMemoryDashboardApi(), [apiProp]);

  return (
    <DashboardEditModeProvider>
      <DashboardPageInner appName={appName} api={api} />
    </DashboardEditModeProvider>
  );
}

function DashboardPageInner({
  appName,
  api,
}: {
  appName: string;
  api: DashboardApi;
}) {
  const dashboard = useDashboard(api);
  const { editMode, enterEditMode, requestExitEditMode, modeAnnouncement } = useDashboardEditMode();
  const [activeSlug, setActiveSlug] = useState<string | null>(() => readPageSlugFromPath());
  const [editor, setEditor] = useState<EditorState>({ open: false });
  const [deleteTarget, setDeleteTarget] = useState<Page | null>(null);

  useEffect(() => {
    const onPopState = () => {
      setActiveSlug(readPageSlugFromPath());
    };
    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("popstate", onPopState);
    };
  }, []);

  const pages = dashboard.state.status === "ready" ? dashboard.state.dashboard.pages : [];

  const activePage = useMemo(() => {
    if (pages.length === 0) {
      return null;
    }
    if (activeSlug) {
      const match = pages.find((page) => page.slug === activeSlug);
      if (match) {
        return match;
      }
    }
    return pages[0] ?? null;
  }, [activeSlug, pages]);

  useEffect(() => {
    if (dashboard.state.status !== "ready" || !activePage) {
      return;
    }
    const expected = pagePath(activePage.slug);
    if (window.location.pathname !== expected) {
      navigate(expected);
      setActiveSlug(activePage.slug);
    }
  }, [activePage, dashboard.state.status]);

  const selectPage = useCallback((page: Page) => {
    setActiveSlug(page.slug);
    navigate(pagePath(page.slug));
  }, []);

  const movePage = useCallback(
    async (page: Page, direction: -1 | 1) => {
      const index = pages.findIndex((candidate) => candidate.id === page.id);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= pages.length) {
        return;
      }
      const ordered = [...pages];
      const [removed] = ordered.splice(index, 1);
      if (!removed) {
        return;
      }
      ordered.splice(target, 0, removed);
      await dashboard.reorderPages(ordered.map((item) => item.id));
    },
    [dashboard, pages],
  );

  const onEditModeChange = useCallback(
    (next: boolean) => {
      if (next) {
        enterEditMode();
        return;
      }
      void requestExitEditMode();
    },
    [enterEditMode, requestExitEditMode],
  );

  if (dashboard.state.status === "loading") {
    return (
      <div className="dash-shell">
        <div className="dash-shell__ambient" aria-hidden="true" />
        <main className="dash-shell__content">
          <Stack gap="md">
            <Skeleton height="3rem" />
            <Skeleton height="12rem" />
            <Skeleton height="8rem" width="70%" />
          </Stack>
        </main>
      </div>
    );
  }

  if (dashboard.state.status === "error") {
    return (
      <div className="dash-shell">
        <div className="dash-shell__ambient" aria-hidden="true" />
        <main className="dash-shell__content">
          <ErrorState
            title="Dashboard unavailable"
            description={dashboard.state.message}
            action={
              <Button type="button" onClick={() => void dashboard.reload()}>
                Try again
              </Button>
            }
          />
        </main>
      </div>
    );
  }

  if (pages.length === 0) {
    return (
      <div className="dash-shell">
        <div className="dash-shell__ambient" aria-hidden="true" />
        <main className="dash-shell__content">
          <EmptyState
            title="No pages yet"
            description="Create your first page to start building this dashboard."
            action={
              <Button type="button" onClick={() => setEditor({ open: true, mode: "create" })}>
                Create page
              </Button>
            }
          />
          <PageEditorDialog
            open={editor.open && editor.mode === "create"}
            mode="create"
            busy={dashboard.busy}
            onOpenChange={(open) => {
              if (!open) {
                setEditor({ open: false });
              }
            }}
            onSubmit={async (input) => {
              const created = await dashboard.createPage(input as CreatePageRequest);
              if (created) {
                setEditor({ open: false });
                selectPage(created);
                return true;
              }
              return false;
            }}
          />
        </main>
      </div>
    );
  }

  return (
    <div className="dash-shell">
      <div className="dash-shell__ambient" aria-hidden="true" />

      <output
        aria-live="polite"
        aria-atomic="true"
        className="visually-hidden"
        data-testid="edit-mode-announcer"
      >
        {modeAnnouncement}
      </output>

      <header className="app-header__nav-sticky">
        <TopNav
          pages={pages}
          activePageId={activePage?.id ?? null}
          onPageChange={selectPage}
          editMode={editMode}
          onEditModeChange={onEditModeChange}
          onCreatePage={() => setEditor({ open: true, mode: "create" })}
          onEditPage={(page) => setEditor({ open: true, mode: "edit", page })}
          onDuplicatePage={(page) => {
            void (async () => {
              const duplicated = await dashboard.duplicatePage(page.id);
              if (duplicated) {
                selectPage(duplicated);
              }
            })();
          }}
          onDeletePage={(page) => setDeleteTarget(page)}
          onMovePage={(page, direction) => {
            void movePage(page, direction);
          }}
          canDeletePages={pages.length > 1}
          returnToPath={activePage ? pagePath(activePage.slug) : getPath()}
          settingsActive={isSettingsPath(getPath())}
        />
      </header>

      <main className="dash-shell__content">
        {dashboard.notice ? (
          <output className="dash-shell__notice">
            {dashboard.notice}
            <Button type="button" variant="ghost" size="sm" onClick={dashboard.clearNotice}>
              Dismiss
            </Button>
          </output>
        ) : null}

        <div className="dash-shell__intro">
          <div>
            <p className="dash-shell__eyebrow">{appName}</p>
            <h1 className="dash-shell__title">{activePage?.name ?? "Dashboard"}</h1>
          </div>
          {editMode ? (
            <output className="dash-shell__edit-banner">
              Edit mode — drag handles move widgets; arrow keys work when a widget is focused.
              Layout saves automatically.
            </output>
          ) : null}
        </div>

        {activePage ? <DashboardLayoutEngine pageId={activePage.id} api={api} /> : null}
      </main>

      <PageEditorDialog
        open={editor.open}
        mode={editor.open ? editor.mode : "create"}
        initial={editor.open && editor.mode === "edit" ? editor.page : null}
        busy={dashboard.busy}
        onOpenChange={(open) => {
          if (!open) {
            setEditor({ open: false });
          }
        }}
        onSubmit={async (input) => {
          if (!editor.open) {
            return false;
          }
          if (editor.mode === "create") {
            const created = await dashboard.createPage(input as CreatePageRequest);
            if (created) {
              setEditor({ open: false });
              selectPage(created);
              return true;
            }
            return false;
          }
          const updated = await dashboard.updatePage(editor.page.id, input as UpdatePageRequest);
          if (updated) {
            setEditor({ open: false });
            if (updated.slug !== editor.page.slug) {
              selectPage(updated);
            }
            return true;
          }
          return false;
        }}
      />

      <ConfirmDeletePageDialog
        open={deleteTarget !== null}
        page={deleteTarget}
        busy={dashboard.busy}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
          }
        }}
        onConfirm={async () => {
          if (!deleteTarget) {
            return false;
          }
          const deletedId = deleteTarget.id;
          const ok = await dashboard.deletePage(deletedId);
          if (ok) {
            if (activePage?.id === deletedId) {
              const remaining = pages.filter((page) => page.id !== deletedId);
              if (remaining[0]) {
                selectPage(remaining[0]);
              }
            }
            setDeleteTarget(null);
          }
          return ok;
        }}
      />
    </div>
  );
}
