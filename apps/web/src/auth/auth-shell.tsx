import { Button, Input, Stack, cx, useTheme } from "@dashora/ui";
import type { FormEvent, ReactNode } from "react";
import { DashoraMark } from "../dashboard/icons.js";

export type AuthShellProps = {
  title: string;
  lede: string;
  children: ReactNode;
  footer?: ReactNode;
};

export function AuthShell({ title, lede, children, footer }: AuthShellProps) {
  const { resolved, toggle } = useTheme();

  return (
    <div className="auth-shell">
      <div className="auth-shell__ambient" aria-hidden="true" />
      <header className="auth-shell__top">
        <div className="auth-shell__brand">
          <DashoraMark className="auth-shell__mark" />
          <span className="auth-shell__product">Dashora</span>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            toggle();
          }}
        >
          {resolved === "dark" ? "Light theme" : "Dark theme"}
        </Button>
      </header>

      <main className="auth-shell__main">
        <section className="auth-panel" aria-labelledby="auth-panel-title">
          <p className="auth-panel__eyebrow">Self-hosted dashboard</p>
          <h1 id="auth-panel-title" className="auth-panel__title">
            {title}
          </h1>
          <p className="auth-panel__lede">{lede}</p>
          <div className="auth-panel__body">{children}</div>
          {footer ? <div className="auth-panel__footer">{footer}</div> : null}
        </section>
      </main>
    </div>
  );
}

export type AuthFormProps = {
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  children: ReactNode;
  submitLabel: string;
  busy?: boolean;
  error?: string | null;
  className?: string;
};

export function AuthForm({
  onSubmit,
  children,
  submitLabel,
  busy = false,
  error,
  className,
}: AuthFormProps) {
  return (
    <form className={cx("auth-form", className)} onSubmit={onSubmit} noValidate>
      <Stack gap="md">
        {children}
        {error ? (
          <p className="auth-form__error" role="alert">
            {error}
          </p>
        ) : null}
        <Button type="submit" disabled={busy} className="auth-form__submit">
          {busy ? "Working…" : submitLabel}
        </Button>
      </Stack>
    </form>
  );
}

export { Input };
