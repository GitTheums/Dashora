import { afterEach, describe, expect, it } from "vitest";
import { createTestServerEnv } from "../../test/env.js";
import { ProviderError } from "../errors.js";
import { createProviderPlatform } from "../platform.js";
import { type MockUpstreamServer, startMockUpstream } from "../test/mock-upstream.js";
import { createPlatformIcsFeedFetcher } from "./feed-fetcher.js";

const SAMPLE_ICS = `BEGIN:VCALENDAR
VERSION:2.0
X-WR-CALNAME:Team
BEGIN:VEVENT
UID:1@example.test
DTSTART:20260730T100000Z
DTEND:20260730T110000Z
SUMMARY:Sync
END:VEVENT
END:VCALENDAR`;

describe("calendar ICS feed fetcher", () => {
  let upstream: MockUpstreamServer | undefined;

  afterEach(async () => {
    if (upstream) {
      await upstream.close();
      upstream = undefined;
    }
  });

  it("fetches and parses ICS feeds", async () => {
    upstream = await startMockUpstream((_req, res) => {
      res.statusCode = 200;
      res.setHeader("content-type", "text/calendar");
      res.end(SAMPLE_ICS);
    });

    const platform = createProviderPlatform({
      env: createTestServerEnv(),
      fetchImpl: globalThis.fetch,
    });
    const fetcher = createPlatformIcsFeedFetcher(platform);

    const result = await fetcher.fetchFeed(`${upstream.baseUrl}/cal.ics`, {
      rangeStartMs: Date.UTC(2026, 6, 1),
      rangeEndMs: Date.UTC(2026, 7, 1),
    });
    expect(result.feed.calendarName).toBe("Team");
    expect(result.feed.events[0]?.summary).toBe("Sync");
  });

  it("sends basic auth when provided", async () => {
    let sawAuth: string | undefined;
    upstream = await startMockUpstream((req, res) => {
      sawAuth = req.headers.authorization;
      res.statusCode = 200;
      res.setHeader("content-type", "text/calendar");
      res.end(SAMPLE_ICS);
    });

    const platform = createProviderPlatform({
      env: createTestServerEnv(),
      fetchImpl: globalThis.fetch,
    });
    const fetcher = createPlatformIcsFeedFetcher(platform);
    await fetcher.fetchFeed(`${upstream.baseUrl}/cal.ics`, {
      basicAuth: { username: "alice", password: "secret" },
      rangeStartMs: Date.UTC(2026, 6, 1),
      rangeEndMs: Date.UTC(2026, 7, 1),
    });
    expect(sawAuth).toBe(`Basic ${Buffer.from("alice:secret").toString("base64")}`);
  });

  it("maps malformed ICS to parse_error", async () => {
    upstream = await startMockUpstream((_req, res) => {
      res.statusCode = 200;
      res.setHeader("content-type", "text/calendar");
      res.end("not a calendar");
    });

    const platform = createProviderPlatform({
      env: createTestServerEnv(),
      fetchImpl: globalThis.fetch,
    });
    const fetcher = createPlatformIcsFeedFetcher(platform);
    await expect(fetcher.fetchFeed(`${upstream.baseUrl}/bad.ics`)).rejects.toBeInstanceOf(
      ProviderError,
    );
    await expect(fetcher.fetchFeed(`${upstream.baseUrl}/bad.ics`)).rejects.toMatchObject({
      code: "parse_error",
    });
  });
});
