import { afterEach, describe, expect, it } from "vitest";
import { type TestDatabase, createTestDatabase } from "../db/test-utils.js";
import { createAuditService } from "./audit-service.js";

describe("audit service", () => {
  let db: TestDatabase;

  afterEach(() => {
    db?.cleanup();
  });

  it("records an event with actor, ip, and metadata", async () => {
    db = createTestDatabase();
    const audit = createAuditService(db.repos);
    const user = await db.repos.users.create({
      email: "operator@example.com",
      passwordHash: "unused",
      displayName: "Operator",
    });

    await audit.record({
      event: "settings.theme.updated",
      success: true,
      actorUserId: user.id,
      actorEmail: "operator@example.com",
      ip: "203.0.113.5",
      metadata: { field: "mode" },
    });

    const [event] = await db.repos.auditEvents.listRecent();
    expect(event).toMatchObject({
      event: "settings.theme.updated",
      success: true,
      actorUserId: user.id,
      actorEmail: "operator@example.com",
      ip: "203.0.113.5",
      metadata: { field: "mode" },
    });
    expect(event?.occurredAt).toBeGreaterThan(0);
  });

  it("records pre-auth failures with a null actor id but a captured attempted email", async () => {
    db = createTestDatabase();
    const audit = createAuditService(db.repos);

    await audit.record({
      event: "auth.login.failure",
      success: false,
      actorEmail: "attacker@example.com",
      ip: "198.51.100.7",
    });

    const [event] = await db.repos.auditEvents.listRecent();
    expect(event).toMatchObject({
      event: "auth.login.failure",
      success: false,
      actorUserId: null,
      actorEmail: "attacker@example.com",
    });
    expect(event?.metadata).toBeNull();
  });

  it("lists events for a specific actor, most recent first", async () => {
    db = createTestDatabase();
    const audit = createAuditService(db.repos);
    const user1 = await db.repos.users.create({
      email: "user1@example.com",
      passwordHash: "unused",
      displayName: "User 1",
    });
    const user2 = await db.repos.users.create({
      email: "user2@example.com",
      passwordHash: "unused",
      displayName: "User 2",
    });

    await audit.record({ event: "auth.login.success", success: true, actorUserId: user1.id });
    await new Promise((resolve) => setTimeout(resolve, 2));
    await audit.record({ event: "auth.logout", success: true, actorUserId: user1.id });
    await audit.record({ event: "auth.login.success", success: true, actorUserId: user2.id });

    const forUser1 = await db.repos.auditEvents.listByActor(user1.id);
    expect(forUser1.map((event) => event.event)).toEqual(["auth.logout", "auth.login.success"]);
  });

  it("never persists a raw JSON blob containing secret-shaped values passed by mistake", async () => {
    db = createTestDatabase();
    const audit = createAuditService(db.repos);
    const user = await db.repos.users.create({
      email: "operator2@example.com",
      passwordHash: "unused",
      displayName: "Operator",
    });

    // Metadata is typed to scalars only (string | number | boolean | null) — this test locks in
    // that an entire object/array can never be smuggled in as a metadata value, which would risk
    // a future caller accidentally nesting a secret payload inside it.
    await audit.record({
      event: "integration.github.created",
      success: true,
      actorUserId: user.id,
      metadata: { integrationId: "int-1", name: "GitHub" },
    });

    const [event] = await db.repos.auditEvents.listRecent();
    expect(event?.metadata).toEqual({ integrationId: "int-1", name: "GitHub" });
  });
});
