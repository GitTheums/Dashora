import { Input } from "@dashora/ui";
import { type FormEvent, useState } from "react";
import { type AuthApi, AuthApiError } from "./api.js";
import { AuthForm, AuthShell } from "./auth-shell.js";
import { navigate } from "./routing.js";

export type LoginPageProps = {
  api: AuthApi;
  onAuthenticated: () => void;
  notice?: string | null;
};

export function LoginPage({ api, onAuthenticated, notice = null }: LoginPageProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api.login({
        email: email.trim(),
        password,
      });
      onAuthenticated();
      navigate("/");
    } catch (err) {
      if (err instanceof AuthApiError) {
        setError(err.message);
      } else {
        setError("Sign-in failed. Check the server and try again.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title="Sign in to Dashora"
      lede="Use your local operator account. Sessions are stored server-side in an HTTP-only cookie — nothing is kept in localStorage."
      footer={
        <p className="auth-panel__hint">
          First install? Look for the setup URL in the server logs, then open{" "}
          <span className="auth-mono">/setup</span>.
        </p>
      }
    >
      {notice ? <output className="auth-callout auth-callout--muted">{notice}</output> : null}
      <AuthForm onSubmit={onSubmit} submitLabel="Sign in" busy={busy} error={error}>
        <Input
          label="Email"
          name="email"
          type="email"
          autoComplete="username"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
        <Input
          label="Password"
          name="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
      </AuthForm>
    </AuthShell>
  );
}
