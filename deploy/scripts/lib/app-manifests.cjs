/**
 * CommonJS view of the manifest snapshot, for the audits that are still
 * `require`-based. Same file and same rules as ./app-manifests.mjs - see that
 * file for why the snapshot exists and what it is not for.
 */
const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "../../..");
const snapshotPath = path.join(
  repoRoot,
  "platform/host-app/public/miniapp-manifests.json",
);

let cached = null;

function load() {
  if (cached) return cached;
  let raw;
  try {
    raw = fs.readFileSync(snapshotPath, "utf8");
  } catch (error) {
    throw new Error(
      `cannot read the app manifest snapshot at ${path.relative(repoRoot, snapshotPath)}: ` +
        `${error.message}. Run: node scripts/refresh-manifest-snapshot.mjs`,
    );
  }
  const parsed = JSON.parse(raw);
  const manifests = parsed && typeof parsed.manifests === "object" ? parsed.manifests : null;
  // An empty snapshot means a broken refresh, not a platform with no apps.
  // Auditing zero apps and reporting success is the failure mode worth
  // preventing here.
  if (!manifests || Object.keys(manifests).length === 0) {
    throw new Error(
      `the app manifest snapshot at ${path.relative(repoRoot, snapshotPath)} is empty. ` +
        `Run: node scripts/refresh-manifest-snapshot.mjs`,
    );
  }
  cached = manifests;
  return cached;
}

/** Every app slug in the snapshot, sorted. */
function listAppSlugs() {
  return Object.keys(load()).sort();
}

/** One app's manifest. Throws when the slug is not in the snapshot. */
function readAppManifest(slug) {
  const manifest = load()[slug];
  if (!manifest) {
    throw new Error(`no manifest for "${slug}" in the snapshot`);
  }
  return manifest;
}

/** [slug, manifest] pairs, sorted by slug. */
function eachAppManifest() {
  return listAppSlugs().map((slug) => [slug, load()[slug]]);
}

module.exports = { listAppSlugs, readAppManifest, eachAppManifest };
