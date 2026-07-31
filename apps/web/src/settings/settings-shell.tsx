import { Button, cx } from "@dashora/ui";
import type { ReactNode } from "react";
import { navigate } from "../auth/routing.js";
import { BrandMark, useBrandName } from "../theme/brand-mark.js";
import {
  type SettingsSection,
  settingsAccountHref,
  settingsAppearanceHref,
  settingsBackupHref,
} from "./paths.js";

export type SettingsShellProps = {
  children: ReactNode;
  activeSection?: SettingsSection;
  returnTo: string;
  onBack: () => void;
  onNavigateHome: () => void;
};

export function SettingsShell({
  children,
  activeSection = "appearance",
  returnTo,
  onBack,
  onNavigateHome,
}: SettingsShellProps) {
  const brandName = useBrandName();
  const returnArg = returnTo === "/" ? null : returnTo;

  return (
    <div className="settings-shell">
      <div className="settings-shell__ambient" aria-hidden="true" />
      <header className="settings-shell__top">
        <button
          type="button"
          className="settings-shell__brand"
          aria-label={`${brandName} home`}
          onClick={onNavigateHome}
        >
          <BrandMark showName nameClassName="settings-shell__wordmark" />
        </button>
        <Button type="button" variant="ghost" size="sm" onClick={onBack}>
          Back to dashboard
        </Button>
      </header>

      <div className="settings-shell__layout">
        <aside className="settings-shell__nav" aria-label="Settings sections">
          <p className="settings-shell__nav-title">Settings</p>
          <nav className="settings-shell__nav-list">
            <a
              href={settingsAppearanceHref(returnArg)}
              className={cx(
                "settings-shell__nav-link",
                activeSection === "appearance" && "is-active",
              )}
              aria-current={activeSection === "appearance" ? "page" : undefined}
              onClick={(event) => {
                event.preventDefault();
                navigate(settingsAppearanceHref(returnArg));
              }}
            >
              Appearance
            </a>
            <a
              href={settingsAccountHref(returnArg)}
              className={cx("settings-shell__nav-link", activeSection === "account" && "is-active")}
              aria-current={activeSection === "account" ? "page" : undefined}
              onClick={(event) => {
                event.preventDefault();
                navigate(settingsAccountHref(returnArg));
              }}
            >
              Account
            </a>
            <a
              href={settingsBackupHref(returnArg)}
              className={cx("settings-shell__nav-link", activeSection === "backup" && "is-active")}
              aria-current={activeSection === "backup" ? "page" : undefined}
              onClick={(event) => {
                event.preventDefault();
                navigate(settingsBackupHref(returnArg));
              }}
            >
              Backup
            </a>
          </nav>
        </aside>

        <main className="settings-shell__main" id="settings-main">
          {children}
        </main>
      </div>
    </div>
  );
}
