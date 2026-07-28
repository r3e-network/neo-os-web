/**
 * App metadata for platform audits, read from the committed manifest snapshot.
 *
 * The apps live in neo-minigames and neo-miniapps now, so nothing here can walk
 * a sibling apps/ directory. platform/host-app/public/miniapp-manifests.json
 * holds every manifest verbatim and scripts/refresh-manifest-snapshot.mjs
 * rebuilds it from those repos, with --check wired into CI so a stale snapshot
 * fails instead of drifting.
 *
 * Audits that need app *source* rather than metadata do not belong here - they
 * belong in the repo that holds the source.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const snapshotPath = path.join(repoRoot, "platform/host-app/public/miniapp-manifests.json");

let cached = null;

function load() {
  if (cached) return cached;
  let raw;
  try {
    raw = fs.readFileSync(snapshotPath, "utf8");
  } catch (error) {
    throw new Error(
      `cannot read the manifest snapshot at ${path.relative(repoRoot, snapshotPath)}: ${error.message}. ` +
        `Run: node scripts/refresh-manifest-snapshot.mjs`,
    );
  }
  const parsed = JSON.parse(raw);
  const manifests = parsed && typeof parsed === "object" ? parsed.manifests : null;
  if (!manifests || typeof manifests !== "object" || Object.keys(manifests).length === 0) {
    // An empty snapshot must fail loudly. Reporting success over zero apps is
    // the one outcome worse than failing: every gate would go green while the
    // platform shipped a catalogue nobody checked.
    throw new Error("the manifest snapshot contains no apps - refusing to audit an empty set");
  }
  cached = manifests;
  return cached;
}

/** Every app slug in the snapshot, sorted. */
export function listAppSlugs() {
  return Object.keys(load()).sort();
}

/** One app's manifest, or null when the slug is unknown. */
export function readAppManifest(slug) {
  return load()[slug] ?? null;
}

/** [slug, manifest] for every app, sorted by slug. */
export function eachAppManifest() {
  const manifests = load();
  return listAppSlugs().map((slug) => [slug, manifests[slug]]);
}

/** Slugs whose manifest declares a contract on any network. */
export function listContractAppSlugs() {
  return eachAppManifest()
    .filter(([, manifest]) => Object.keys(manifest?.contracts ?? {}).length > 0)
    .map(([slug]) => slug);
}
