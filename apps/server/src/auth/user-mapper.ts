import type { AuthUser } from "@dashora/shared";
import type { SessionRecord } from "../db/repositories/sessions.js";
import type { UserRecord } from "../db/repositories/users.js";

export function toAuthUser(user: UserRecord): AuthUser {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
  };
}

export type AuthenticatedSession = {
  user: UserRecord;
  session: SessionRecord;
};
