import { Input } from "@dashora/ui";
import { type FormEvent, useState } from "react";
import { type AuthApi, AuthApiError } from "./api.js";
import { AuthForm, AuthShell } from "./auth-shell.js";
import { navigate, readSetupTokenFromLocation } from "./routing.js";

export type SetupPageProps = {
  api: AuthApi;
  token: string | null;
  onAuthenticated: () => void;
};

export function SetupPage({ api, token, onAuthenticated }: SetupPageProps) {
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!token) {
    return (
      <AuthShell
        title="Setup token required"
        lede="Dashora has not created an operator yet. Open the one-time setup URL from the server logs — the token is never shown in the browser without that link."
        footer={
          <p className="auth-panel__hint">
            Already finished setup?{" "}
            <button type="button" className="auth-link" onClick={() => navigate("/login")}>
              Sign in
            </button>
          </p>
        }
      >
        <output className="auth-callout">
          Check the server console for a line starting with “Dashora first-run setup required”.
        </output>
      </AuthShell>
    );
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    // Re-read the exact URL token at submit time — no trim/transform/localStorage.
    const urlToken = readSetupTokenFromLocation();
    if (!urlToken) {
      setError("Setup token is required");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 12) {
      setError("Password must be at least 12 characters.");
      return;
    }

    setBusy(true);
    try {
      await api.setup({
        token: urlToken,
        email: email.trim(),
        displayName: displayName.trim(),
        password,
      });
      onAuthenticated();
      navigate("/");
    } catch (err) {
      if (err instanceof AuthApiError) {
        setError(err.message);
      } else {
        setError("Setup failed. Check the server and try again.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title="Create your admin account"
      lede="This one-time setup creates the first Dashora operator. The setup token is invalidated as soon as this succeeds."
      footer={
        <p className="auth-panel__hint">
          Passwords are hashed with Argon2id and never written to logs.
        </p>
      }
    >
      <AuthForm onSubmit={onSubmit} submitLabel="Create admin" busy={busy} error={error}>
        <Input
          label="Display name"
          name="displayName"
          autoComplete="name"
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          required
        />
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
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          hint="At least 12 characters."
          required
        />
        <Input
          label="Confirm password"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          required
        />
      </AuthForm>
    </AuthShell>
  );
}
