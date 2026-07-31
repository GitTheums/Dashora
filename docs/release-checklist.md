# Release checklist

Operator-facing steps for cutting a Dashora release. The GitHub Actions **Release** workflow publishes the GHCR image and creates the GitHub Release when a `v*.*.*` tag is pushed. **Do not push a tag until the checklist below is green.**

## 1. Preflight

- [ ] `main` is green on CI (`Lint, typecheck, test, build`, `Playwright E2E, a11y, visual`, `Docker image smoke (amd64) + multi-arch build`)
- [ ] [CHANGELOG.md](../CHANGELOG.md) has an entry for the version being released
- [ ] Root `package.json` and `@dashora/server` / `@dashora/web` versions match the intended public version
- [ ] `apps/server/.env.example` `APP_VERSION` matches (documentation default)
- [ ] `compose.yaml` / `infra/Dockerfile` default `VERSION` matches for local builds
- [ ] Docs mention `ghcr.io/gittheums/dashora` (not placeholders)
- [ ] No secrets, `.env` files, databases, or credentials are staged for commit
- [ ] Apache-2.0 license references are consistent (`LICENSE`, `package.json`, OCI labels, docs)

## 2. Local validation (required)

Run from the repository root:

```bash
pnpm install --frozen-lockfile
pnpm exec biome ci --linter-enabled=false --organize-imports-enabled=false --assists-enabled=false .
pnpm lint
pnpm typecheck
pnpm test
pnpm test:coverage
pnpm build
DASHORA_REQUIRE_DOCKER=1 pnpm test:container
```

Optional but recommended before a major/minor:

```bash
pnpm test:e2e
```

## 3. Version and docs

- [ ] Update [CHANGELOG.md](../CHANGELOG.md) date and notes (Keep a Changelog style)
- [ ] Update [SECURITY.md](../SECURITY.md) supported-versions table if the support policy changes
- [ ] Skim [README.md](../README.md), [installation](./installation.md), [upgrading](./upgrading.md), and [backup-restore](./backup-restore.md) for accuracy
- [ ] Confirm screenshot paths under `docs/images/` still resolve

## 4. Tag and publish (manual)

Publishing is intentionally manual. After the release commit is on `main`:

```bash
# Example for 1.0.0 — adjust the version
git tag -a v1.0.0 -m "Dashora 1.0.0"
git push origin v1.0.0
```

The **Release** workflow will:

1. Re-run the same quality checks as CI and fail closed on errors
2. Build and push `linux/amd64` + `linux/arm64` to `ghcr.io/gittheums/dashora`
3. Apply semver tags (`1.0.0`, `1.0`, `1`, and `latest` for stable tags only)
4. Generate provenance attestation
5. Create (or update) the GitHub Release with generated notes

Prerelease tags such as `v1.1.0-rc.1` publish the full version tag only and **must not** update `latest`, `1`, or `1.1`.

## 5. Post-publish verification

- [ ] GitHub Release exists for the tag with the version as the title
- [ ] `docker pull ghcr.io/gittheums/dashora:<version>` succeeds for amd64 and arm64 (or inspect the multi-arch manifest)
- [ ] `GET /api/v1/health` on a fresh container reports the expected `version`
- [ ] Spot-check first-run setup, login, and one widget that uses an integration secret
- [ ] Confirm package visibility / repo Packages settings allow intended consumers to pull

## 6. Rollback

If the published image is bad:

1. Do **not** delete the git tag casually — prefer a new patch release
2. Point operators at the previous known-good tag (see [upgrading](./upgrading.md) rollback)
3. Yank `latest` only by publishing a corrected stable tag that re-points `latest`

## Related

- [Upgrading](./upgrading.md)
- [Infrastructure](../infra/README.md)
- [SECURITY.md](../SECURITY.md)
