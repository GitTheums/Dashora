import type { AuthUser } from "@dashora/shared";
import { Button, SectionHeader } from "@dashora/ui";
import { useEffect } from "react";

export type AccountPageProps = {
  user: AuthUser;
  onSignOut: () => void;
};

export function AccountPage({ user, onSignOut }: AccountPageProps) {
  useEffect(() => {
    document.getElementById("account-heading")?.focus();
  }, []);

  return (
    <div className="account-page">
      <header className="account-page__header">
        <h1 className="account-page__title" tabIndex={-1} id="account-heading">
          Account
        </h1>
        <p className="account-page__lede">Your signed-in identity for this Dashora instance.</p>
      </header>

      <section className="account-page__section" aria-labelledby="account-profile">
        <SectionHeader
          id="account-profile"
          title="Profile"
          description="Details from your local Dashora account."
        />
        <dl className="account-page__details">
          <div>
            <dt>Display name</dt>
            <dd>{user.displayName}</dd>
          </div>
          <div>
            <dt>Email</dt>
            <dd>{user.email}</dd>
          </div>
        </dl>
      </section>

      <section className="account-page__section" aria-labelledby="account-session">
        <SectionHeader
          id="account-session"
          title="Session"
          description="Sign out ends this browser session on the server."
        />
        <Button type="button" variant="secondary" onClick={onSignOut}>
          Sign out
        </Button>
      </section>
    </div>
  );
}
