import { spawnSync } from "node:child_process";
import { readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const distAssets = join(webRoot, "dist", "assets");

const build = spawnSync("pnpm", ["exec", "vite", "build"], {
  cwd: webRoot,
  env: { ...process.env, ANALYZE: "1" },
  stdio: "inherit",
  shell: true,
});

if (build.status !== 0) {
  process.exit(build.status ?? 1);
}

const rows = readdirSync(distAssets)
  .filter((name) => name.endsWith(".js") || name.endsWith(".css"))
  .map((name) => {
    const path = join(distAssets, name);
    const bytes = statSync(path).size;
    let gzipBytes;
    let brotliBytes;
    try {
      gzipBytes = statSync(`${path}.gz`).size;
    } catch {
      gzipBytes = undefined;
    }
    try {
      brotliBytes = statSync(`${path}.br`).size;
    } catch {
      brotliBytes = undefined;
    }
    return { name, bytes, gzipBytes, brotliBytes };
  })
  .sort((a, b) => b.bytes - a.bytes);

const summary = {
  generatedAt: new Date().toISOString(),
  assets: rows,
  totals: {
    bytes: rows.reduce((sum, row) => sum + row.bytes, 0),
    gzipBytes: rows.reduce((sum, row) => sum + (row.gzipBytes ?? 0), 0),
    brotliBytes: rows.reduce((sum, row) => sum + (row.brotliBytes ?? 0), 0),
  },
};

const outPath = join(webRoot, "dist", "bundle-summary.json");
writeFileSync(outPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");

console.log("\nBundle summary (JS/CSS):");
for (const row of rows.slice(0, 20)) {
  const gz = row.gzipBytes !== undefined ? ` gz=${(row.gzipBytes / 1024).toFixed(1)}KB` : "";
  console.log(`  ${(row.bytes / 1024).toFixed(1).padStart(8)}KB${gz}  ${row.name}`);
}
console.log(`\nWrote ${outPath}`);
console.log(`Treemap: ${join(webRoot, "dist", "bundle-stats.html")}`);
