#!/usr/bin/env node
/**
 * Builds the production Dashora image, starts a container, and verifies:
 * - GET /api/v1/health succeeds
 * - SPA assets exist in the image (/srv/dashora-web/index.html)
 * - SIGTERM results in a clean exit
 *
 * Skip locally when Docker is unavailable unless CI or DASHORA_REQUIRE_DOCKER=1.
 */

import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { dirname, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const requireDocker = process.env.CI === "true" || process.env.DASHORA_REQUIRE_DOCKER === "1";
const image = process.env.DASHORA_SMOKE_IMAGE ?? "dashora:smoke";
const hostPort = process.env.DASHORA_SMOKE_PORT ?? "18080";
const containerName = `dashora-smoke-${randomBytes(4).toString("hex")}`;
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...options,
  });
}

function dockerAvailable() {
  const result = run("docker", ["version", "--format", "{{.Server.Version}}"]);
  return result.status === 0;
}

function fail(message, details) {
  console.error(message);
  if (details) {
    console.error(details);
  }
  process.exit(1);
}

async function waitForHealth(url, attempts = 40, intervalMs = 500) {
  let lastError = "unknown";
  for (let i = 0; i < attempts; i += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return response.json();
      }
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await delay(intervalMs);
  }
  throw new Error(`Health check did not become ready: ${lastError}`);
}

function cleanup() {
  run("docker", ["rm", "-f", containerName]);
}

async function main() {
  if (!dockerAvailable()) {
    if (requireDocker) {
      fail("Docker is required for container smoke tests but is not available.");
    }
    console.log("Skipping container smoke test: Docker is not available.");
    process.exit(0);
  }

  console.log(`Building ${image}...`);
  const build = spawnSync(
    "docker",
    [
      "build",
      "-f",
      "infra/Dockerfile",
      "-t",
      image,
      "--build-arg",
      "VERSION=0.0.0-smoke",
      "--build-arg",
      "REVISION=smoke",
      "--build-arg",
      `BUILD_DATE=${new Date().toISOString()}`,
      ".",
    ],
    { cwd: repoRoot, stdio: "inherit" },
  );
  if (build.status !== 0) {
    fail("Docker build failed.");
  }

  const assetCheck = run("docker", [
    "run",
    "--rm",
    "--entrypoint",
    "node",
    image,
    "-e",
    "const fs=require('node:fs'); process.exit(fs.existsSync('/srv/dashora-web/index.html')?0:1)",
  ]);
  if (assetCheck.status !== 0) {
    fail("Built image is missing /srv/dashora-web/index.html");
  }
  console.log("Web assets present in image.");

  cleanup();
  console.log(`Starting ${containerName} on host port ${hostPort}...`);
  const start = run("docker", [
    "run",
    "-d",
    "--name",
    containerName,
    "-e",
    "PORT=3000",
    "-e",
    "DASHORA_DATA_DIR=/data",
    "-e",
    "TZ=UTC",
    "-e",
    "CORS_ORIGIN=http://127.0.0.1:5173",
    "-p",
    `${hostPort}:3000`,
    "--read-only",
    "--tmpfs",
    "/tmp",
    "-v",
    `${containerName}-data:/data`,
    image,
  ]);
  if (start.status !== 0) {
    fail("Failed to start container", start.stderr || start.stdout);
  }

  try {
    const healthUrl = `http://127.0.0.1:${hostPort}/api/v1/health`;
    const body = await waitForHealth(healthUrl);
    if (body?.status !== "ok") {
      fail("Unexpected health payload", JSON.stringify(body));
    }
    console.log("Health endpoint OK:", JSON.stringify(body));

    const stop = run("docker", ["stop", "-t", "20", containerName]);
    if (stop.status !== 0) {
      fail("docker stop failed", stop.stderr || stop.stdout);
    }
    const inspect = run("docker", ["inspect", "-f", "{{.State.ExitCode}}", containerName]);
    const exitCode = Number.parseInt((inspect.stdout || "").trim(), 10);
    if (exitCode !== 0) {
      const logs = run("docker", ["logs", containerName]);
      fail(`Expected clean SIGTERM exit code 0, got ${exitCode}`, logs.stderr || logs.stdout);
    }
    console.log("Graceful shutdown OK (exit code 0).");
  } finally {
    cleanup();
    run("docker", ["volume", "rm", "-f", `${containerName}-data`]);
  }

  console.log("Container smoke test passed.");
}

main().catch((error) => {
  cleanup();
  run("docker", ["volume", "rm", "-f", `${containerName}-data`]);
  fail(error instanceof Error ? error.message : String(error));
});
