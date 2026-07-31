import { describe, expect, it } from "vitest";
import {
  API_SECRET_INTEGRATION_PROVIDER,
  GITHUB_INTEGRATION_PROVIDER,
  ICS_BASIC_AUTH_INTEGRATION_PROVIDER,
  createApiSecretIntegrationRequestSchema,
  createGithubIntegrationRequestSchema,
  createIcsBasicAuthIntegrationRequestSchema,
  githubIntegrationPublicSchema,
  updateApiSecretIntegrationRequestSchema,
  updateGithubIntegrationRequestSchema,
  updateIcsBasicAuthIntegrationRequestSchema,
} from "./integrations.js";

const ISO = "2026-07-31T09:00:00.000Z";
const UUID = "11111111-1111-4111-8111-111111111111";

describe("integration schemas", () => {
  it("accepts a public GitHub integration without secrets", () => {
    const parsed = githubIntegrationPublicSchema.parse({
      id: UUID,
      provider: GITHUB_INTEGRATION_PROVIDER,
      name: "GitHub",
      hasToken: true,
      tokenHint: "abcd",
      createdAt: ISO,
      updatedAt: ISO,
    });
    expect(parsed.hasToken).toBe(true);
    expect(parsed.tokenHint).toBe("abcd");
  });

  it("rejects GitHub tokens with whitespace", () => {
    expect(
      createGithubIntegrationRequestSchema.safeParse({
        name: "GitHub",
        token: "ghp_bad token",
      }).success,
    ).toBe(false);
  });

  it("requires name or token on GitHub update", () => {
    expect(updateGithubIntegrationRequestSchema.safeParse({}).success).toBe(false);
    expect(updateGithubIntegrationRequestSchema.safeParse({ name: "Work" }).success).toBe(true);
  });

  it("accepts ICS basic-auth create payloads", () => {
    const parsed = createIcsBasicAuthIntegrationRequestSchema.parse({
      username: "calendar-user",
      password: "s3cret",
    });
    expect(parsed.name).toBe("ICS feed");
    expect(parsed.username).toBe("calendar-user");
  });

  it("requires username and password together on ICS update", () => {
    expect(updateIcsBasicAuthIntegrationRequestSchema.safeParse({ username: "only" }).success).toBe(
      false,
    );
    expect(
      updateIcsBasicAuthIntegrationRequestSchema.safeParse({
        username: "user",
        password: "pass",
      }).success,
    ).toBe(true);
  });

  it("rejects API secrets with control characters", () => {
    expect(
      createApiSecretIntegrationRequestSchema.safeParse({
        secret: "line\nbreak",
      }).success,
    ).toBe(false);
    expect(
      createApiSecretIntegrationRequestSchema.safeParse({
        secret: "ok-secret",
      }).success,
    ).toBe(true);
  });

  it("requires name or secret on API secret update", () => {
    expect(updateApiSecretIntegrationRequestSchema.safeParse({}).success).toBe(false);
    expect(updateApiSecretIntegrationRequestSchema.safeParse({ name: "Twitch" }).success).toBe(
      true,
    );
  });

  it("keeps provider literals distinct", () => {
    expect(GITHUB_INTEGRATION_PROVIDER).toBe("github");
    expect(ICS_BASIC_AUTH_INTEGRATION_PROVIDER).toBe("ics-basic-auth");
    expect(API_SECRET_INTEGRATION_PROVIDER).toBe("api-secret");
  });
});
