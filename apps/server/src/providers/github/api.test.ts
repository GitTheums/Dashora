import { describe, expect, it } from "vitest";
import { createTestServerEnv } from "../../test/env.js";
import { createProviderPlatform } from "../platform.js";
import { createGithubAdapters } from "./api.js";

describe("GitHub API adapters", () => {
  it("fetches repository metadata and open PR counts", async () => {
    const fetchImpl: typeof fetch = async (input) => {
      const url = String(input);
      if (url.includes("/repos/dashora/dashora/pulls")) {
        return new Response(JSON.stringify([{ id: 1 }]), {
          status: 200,
          headers: {
            "content-type": "application/json",
            link: '<https://api.github.com/repositories/1/pulls?state=open&per_page=1&page=2>; rel="last"',
          },
        });
      }
      if (url.includes("/repos/dashora/dashora/languages")) {
        return new Response(JSON.stringify({ TypeScript: 900, CSS: 100 }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      if (url.endsWith("/repos/dashora/dashora") || url.includes("/repos/dashora/dashora?")) {
        return new Response(
          JSON.stringify({
            name: "dashora",
            full_name: "dashora/dashora",
            description: "Dashboard",
            html_url: "https://github.com/dashora/dashora",
            stargazers_count: 10,
            forks_count: 2,
            open_issues_count: 5,
            language: "TypeScript",
            private: false,
            pushed_at: "2026-07-30T10:00:00Z",
            updated_at: "2026-07-30T11:00:00Z",
            owner: { login: "dashora" },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      return new Response("not found", { status: 404 });
    };

    const platform = createProviderPlatform({
      env: createTestServerEnv(),
      fetchImpl,
    });
    const { repository } = createGithubAdapters(platform);
    const result = await repository.fetchRepository({
      owner: "dashora",
      repo: "dashora",
      now: new Date("2026-07-30T12:00:00.000Z"),
    });

    expect(result.repository.stars).toBe(10);
    expect(result.repository.openPullRequests).toBe(2);
    expect(result.repository.openIssues).toBe(3);
    expect(result.repository.primaryLanguage).toBe("TypeScript");
    expect(result.repository.languages[0]?.name).toBe("TypeScript");
  });

  it("maps missing repositories to not_found/private errors", async () => {
    const platform = createProviderPlatform({
      env: createTestServerEnv(),
      fetchImpl: async () => new Response("missing", { status: 404 }),
    });
    const { repository } = createGithubAdapters(platform);
    await expect(
      repository.fetchRepository({ owner: "dashora", repo: "missing" }),
    ).rejects.toMatchObject({ code: "private" });
  });

  it("maps 429 to rate_limited", async () => {
    const platform = createProviderPlatform({
      env: createTestServerEnv(),
      fetchImpl: async () => new Response("slow down", { status: 429 }),
    });
    const { repository } = createGithubAdapters(platform);
    await expect(
      repository.fetchRepository({ owner: "dashora", repo: "dashora" }),
    ).rejects.toMatchObject({ code: "rate_limited" });
  });

  it("returns the latest non-draft release and respects prerelease filtering", async () => {
    const fetchImpl: typeof fetch = async () =>
      new Response(
        JSON.stringify([
          {
            id: 2,
            tag_name: "v2.0.0-rc.1",
            name: "RC",
            html_url: "https://github.com/dashora/dashora/releases/tag/v2.0.0-rc.1",
            published_at: "2026-07-30T09:00:00Z",
            prerelease: true,
            draft: false,
          },
          {
            id: 1,
            tag_name: "v1.0.0",
            name: "Stable",
            html_url: "https://github.com/dashora/dashora/releases/tag/v1.0.0",
            published_at: "2026-07-20T09:00:00Z",
            prerelease: false,
            draft: false,
          },
        ]),
        { status: 200, headers: { "content-type": "application/json" } },
      );

    const platform = createProviderPlatform({
      env: createTestServerEnv(),
      fetchImpl,
    });
    const { releases } = createGithubAdapters(platform);

    const stable = await releases.fetchLatestRelease({
      owner: "dashora",
      repo: "dashora",
      includePrereleases: false,
    });
    expect(stable.release?.tagName).toBe("v1.0.0");

    const withPre = await releases.fetchLatestRelease({
      owner: "dashora",
      repo: "dashora",
      includePrereleases: true,
    });
    expect(withPre.release?.tagName).toBe("v2.0.0-rc.1");
  });
});
