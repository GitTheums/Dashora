import type { Page } from "@dashora/shared";
import {
  Button,
  CommandMenu,
  type CommandMenuItem,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  EmptyState,
  IconButton,
  cx,
  useTheme,
} from "@dashora/ui";
import {
  type CSSProperties,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  DashoraMark,
  EditIcon,
  MenuIcon,
  MoonIcon,
  MoreIcon,
  SearchIcon,
  SunIcon,
} from "./icons.js";
import { PageIconGlyph } from "./page-icons.js";

export type TopNavProps = {
  pages: Page[];
  activePageId: string | null;
  onPageChange: (page: Page) => void;
  editMode: boolean;
  onEditModeChange: (editMode: boolean) => void;
  onCreatePage: () => void;
  onEditPage: (page: Page) => void;
  onDuplicatePage: (page: Page) => void;
  onDeletePage: (page: Page) => void;
  onMovePage: (page: Page, direction: -1 | 1) => void;
  canDeletePages: boolean;
};

export function TopNav({
  pages,
  activePageId,
  onPageChange,
  editMode,
  onEditModeChange,
  onCreatePage,
  onEditPage,
  onDuplicatePage,
  onDeletePage,
  onMovePage,
  canDeletePages,
}: TopNavProps) {
  const { resolved, toggle } = useTheme();
  const [commandOpen, setCommandOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(pages.length);
  const navRef = useRef<HTMLElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/i.test(navigator.platform);

  const openCommand = useCallback(() => {
    setCommandOpen(true);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  useLayoutEffect(() => {
    const nav = navRef.current;
    const measure = measureRef.current;
    if (!nav || !measure) {
      return;
    }

    const update = () => {
      const isNarrow =
        typeof window !== "undefined" &&
        typeof window.matchMedia === "function" &&
        window.matchMedia("(max-width: 767px)").matches;
      if (isNarrow) {
        setVisibleCount(pages.length);
        return;
      }
      const available = nav.clientWidth;
      const items = Array.from(measure.querySelectorAll<HTMLElement>("[data-measure-page]"));
      const moreWidth =
        measure.querySelector<HTMLElement>("[data-measure-more]")?.offsetWidth ?? 72;
      if (items.length === 0) {
        setVisibleCount(0);
        return;
      }

      let used = 0;
      let fit = items.length;
      for (let index = 0; index < items.length; index += 1) {
        const width = items[index]?.offsetWidth ?? 0;
        const remaining = items.length - index - 1;
        const reserve = remaining > 0 ? moreWidth + 8 : 0;
        if (used + width + reserve > available) {
          fit = index;
          break;
        }
        used += width + 4;
      }
      // jsdom often reports 0 width — treat that as "show all".
      if (available <= 0) {
        setVisibleCount(pages.length);
        return;
      }
      setVisibleCount(Math.max(1, Math.min(fit, items.length)));
    };

    update();
    if (typeof ResizeObserver === "undefined") {
      return;
    }
    const observer = new ResizeObserver(update);
    observer.observe(nav);
    return () => {
      observer.disconnect();
    };
  }, [pages]);

  const visiblePages = pages.slice(0, visibleCount);
  const overflowPages = pages.slice(visibleCount);

  const commandItems = useMemo<CommandMenuItem[]>(
    () => [
      ...pages.map((page) => ({
        id: `page-${page.id}`,
        label: `Go to ${page.name}`,
        group: "Pages",
        onSelect: () => {
          onPageChange(page);
          setMobileNavOpen(false);
        },
      })),
      {
        id: "create-page",
        label: "Create page",
        group: "Pages",
        onSelect: () => {
          onCreatePage();
        },
      },
      {
        id: "toggle-theme",
        label: resolved === "dark" ? "Switch to light theme" : "Switch to dark theme",
        group: "Appearance",
        shortcut: "T",
        onSelect: () => {
          toggle();
        },
      },
      {
        id: "edit-dashboard",
        label: editMode ? "Exit edit mode" : "Edit dashboard",
        group: "Dashboard",
        onSelect: () => {
          onEditModeChange(!editMode);
        },
      },
      {
        id: "design-system",
        label: "Open design system",
        group: "Developer",
        onSelect: () => {
          window.location.href = "/design-system";
        },
      },
    ],
    [editMode, onCreatePage, onEditModeChange, onPageChange, pages, resolved, toggle],
  );

  function renderPageButton(page: Page, options?: { inOverflow?: boolean }) {
    const active = activePageId === page.id;
    const pageIndex = pages.findIndex((candidate) => candidate.id === page.id);
    const canMoveLeft = pageIndex > 0;
    const canMoveRight = pageIndex >= 0 && pageIndex < pages.length - 1;
    return (
      <div key={page.id} className={cx("top-nav__page-wrap", options?.inOverflow && "is-stack")}>
        <button
          type="button"
          className={cx("top-nav__page", active && "is-active")}
          aria-current={active ? "page" : undefined}
          style={page.accent ? ({ "--page-accent": page.accent } as CSSProperties) : undefined}
          onClick={() => {
            onPageChange(page);
            setMobileNavOpen(false);
          }}
        >
          <span className="top-nav__page-icon" aria-hidden="true">
            <PageIconGlyph icon={page.icon} />
          </span>
          <span>{page.name}</span>
        </button>
        {editMode ? (
          <DropdownMenu>
            <DropdownMenuTrigger>
              <IconButton
                label={`Page actions for ${page.name}`}
                size="sm"
                className="top-nav__page-menu"
              >
                <MoreIcon />
              </IconButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem
                onSelect={() => {
                  onEditPage(page);
                }}
              >
                Rename page
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => {
                  onDuplicatePage(page);
                }}
              >
                Duplicate page
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={!canMoveLeft}
                onSelect={() => {
                  onMovePage(page, -1);
                }}
              >
                Move left
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={!canMoveRight}
                onSelect={() => {
                  onMovePage(page, 1);
                }}
              >
                Move right
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                danger
                disabled={!canDeletePages}
                onSelect={() => {
                  onDeletePage(page);
                }}
              >
                Delete page
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
    );
  }

  return (
    <>
      <div className="top-nav">
        <div className="top-nav__inner">
          <div className="top-nav__brand">
            <IconButton
              label={mobileNavOpen ? "Close page menu" : "Open page menu"}
              className="top-nav__menu-toggle"
              onClick={() => {
                setMobileNavOpen((open) => !open);
              }}
              aria-expanded={mobileNavOpen}
              aria-controls="dashora-page-nav"
            >
              <MenuIcon />
            </IconButton>
            <a className="top-nav__logo" href="/" aria-label="Dashora home">
              <DashoraMark />
              <span className="top-nav__wordmark">Dashora</span>
            </a>
          </div>

          <nav
            id="dashora-page-nav"
            ref={navRef}
            className={cx("top-nav__pages", mobileNavOpen && "is-open")}
            aria-label="Dashboard pages"
          >
            {visiblePages.map((page) => renderPageButton(page))}
            {overflowPages.length > 0 ? (
              <DropdownMenu>
                <DropdownMenuTrigger>
                  <button type="button" className="top-nav__page top-nav__more">
                    More
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  {overflowPages.map((page) => (
                    <DropdownMenuItem
                      key={page.id}
                      onSelect={() => {
                        onPageChange(page);
                        setMobileNavOpen(false);
                      }}
                    >
                      {page.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
            {editMode ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="top-nav__add-page"
                onClick={onCreatePage}
              >
                Add page
              </Button>
            ) : null}
          </nav>

          <div className="top-nav__measure" ref={measureRef} aria-hidden="true">
            {pages.map((page) => (
              <span key={page.id} data-measure-page className="top-nav__page">
                <span className="top-nav__page-icon">
                  <PageIconGlyph icon={page.icon} />
                </span>
                <span>{page.name}</span>
              </span>
            ))}
            <span data-measure-more className="top-nav__page top-nav__more">
              More
            </span>
          </div>

          <div className="top-nav__actions">
            <Button
              variant="secondary"
              size="sm"
              className="top-nav__command"
              onClick={openCommand}
              aria-keyshortcuts={isMac ? "Meta+K" : "Control+K"}
            >
              <SearchIcon />
              <span className="top-nav__command-label">Search</span>
              <kbd className="top-nav__kbd">{isMac ? "⌘K" : "Ctrl K"}</kbd>
            </Button>
            <IconButton
              label={resolved === "dark" ? "Switch to light theme" : "Switch to dark theme"}
              onClick={toggle}
            >
              {resolved === "dark" ? <SunIcon /> : <MoonIcon />}
            </IconButton>
            <Button
              variant={editMode ? "primary" : "ghost"}
              size="sm"
              className="top-nav__edit"
              aria-pressed={editMode}
              aria-label={editMode ? "Finish editing dashboard" : "Edit dashboard"}
              onClick={() => {
                onEditModeChange(!editMode);
              }}
            >
              <EditIcon />
              <span>{editMode ? "Done" : "Edit"}</span>
            </Button>
          </div>
        </div>
      </div>

      <CommandMenu
        open={commandOpen}
        onOpenChange={setCommandOpen}
        items={commandItems}
        placeholder="Jump to a page or action…"
      />
    </>
  );
}

export function PagePlaceholder({ page }: { page: Page }) {
  return (
    <div className="page-placeholder">
      <EmptyState
        align="center"
        title={`${page.name} page`}
        description="This page is ready for widgets. Layout and data will land in a later phase."
      />
    </div>
  );
}
