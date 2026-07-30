#!/usr/bin/env node
/**
 * Rebuild the committed manifest snapshot the host app reads instead of
 * scanning a sibling apps/ directory.
 *
 * The manifests belong to the app repos now, so this reads them from there. It
 * deliberately does NOT read the CDN: the snapshot has to be reproducible in CI
 * without network, and a catalogue fetch would make every host-app test depend
 * on meshmini.app being up.
 *
 *   node scripts/refresh-manifest-snapshot.mjs [--check]
 *
 * --check verifies the committed snapshot matches the app repos and exits
 * non-zero if it drifted, so CI catches a stale snapshot.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const snapshotPath = path.join(
  repoRoot,
  "platform/host-app/public/miniapp-manifests.json",
);

// Sibling checkouts by default; overridable so CI can point at wherever it
// placed them.
const SOURCES = [
  {
    kind: "minigames",
    dir: process.env.NEO_MINIGAMES_DIR || path.resolve(repoRoot, "../neo-os-minigames"),
  },
  {
    kind: "miniapps",
    dir: process.env.NEO_MINIAPPS_DIR || path.resolve(repoRoot, "../neo-os-miniapps"),
  },
];

async function readManifests(appsDir, kind) {
  const entries = await fs.readdir(appsDir, { withFileTypes: true });
  const out = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const slug = entry.name.trim();
    if (!slug || slug === "shared" || slug === "tests") continue;
    const manifestPath = path.join(appsDir, slug, "neo-manifest.json");
    let raw;
    try {
      raw = await fs.readFile(manifestPath, "utf8");
    } catch {
      continue;
    }
    out.push({ slug, kind, manifest: JSON.parse(raw) });
  }
  return out;
}

async function build() {
  const collected = [];
  for (const source of SOURCES) {
    let appsDir = path.join(source.dir, "apps");
    try {
      await fs.access(appsDir);
    } catch {
      throw new Error(
        `cannot read ${source.kind} manifests: ${appsDir} is missing. ` +
          `Clone r3e-network/neo-os-${source.kind} beside this repo, or set ` +
          `NEO_${source.kind.toUpperCase()}_DIR.`,
      );
    }
    collected.push(...(await readManifests(appsDir, source.kind)));
  }

  // An empty or short read means a checkout is missing, not that the platform
  // has no apps - fail rather than committing a snapshot that silently drops
  // every app the host knows about.
  if (collected.length === 0) {
    throw new Error("no manifests found in either app repo - refusing to write an empty snapshot");
  }

  collected.sort((a, b) => a.slug.localeCompare(b.slug));
  const manifests = {};
  for (const entry of collected) {
    manifests[entry.slug] = { kind: entry.kind, ...entry.manifest };
  }
  return { count: collected.length, manifests };
}

async function main() {
  const check = process.argv.includes("--check");
  const built = await build();
  const serialized = `${JSON.stringify(built, null, 2)}\n`;

  if (check) {
    let committed = "";
    try {
      committed = await fs.readFile(snapshotPath, "utf8");
    } catch {
      console.error(`missing snapshot: ${path.relative(repoRoot, snapshotPath)}`);
      process.exit(1);
    }
    if (committed !== serialized) {
      console.error(
        "manifest snapshot is stale - run: node scripts/refresh-manifest-snapshot.mjs",
      );
      process.exit(1);
    }
    console.log(`manifest snapshot current (${built.count} apps)`);
    return;
  }

  await fs.mkdir(path.dirname(snapshotPath), { recursive: true });
  await fs.writeFile(snapshotPath, serialized);
  console.log(
    `${path.relative(repoRoot, snapshotPath)}: ${built.count} manifests`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
