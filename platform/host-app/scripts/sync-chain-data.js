#!/usr/bin/env node
/**
 * Sync Chain Data Script
 *
 * Syncs supported_chains and contracts data from neo-manifest.json files
 * in miniapps-uniapp/apps/ to platform/host-app/data/miniapps.json
 *
 * Usage: node scripts/sync-chain-data.js
 */

const fs = require("fs");
const path = require("path");

const MINIAPPS_JSON_PATH = path.join(__dirname, "../data/miniapps.json");
const MANIFESTS_DIR = path.join(__dirname, "../../../miniapps-uniapp/apps");

function loadManifests() {
  const manifests = new Map();

  if (!fs.existsSync(MANIFESTS_DIR)) {
    console.warn(`Manifests directory not found: ${MANIFESTS_DIR}`);
    return manifests;
  }

  const apps = fs.readdirSync(MANIFESTS_DIR, { withFileTypes: true });

  for (const app of apps) {
    if (!app.isDirectory()) continue;

    const manifestPath = path.join(MANIFESTS_DIR, app.name, "neo-manifest.json");
    if (!fs.existsSync(manifestPath)) continue;

    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
      if (manifest.app_id) {
        manifests.set(manifest.app_id, manifest);
      }
    } catch (err) {
      console.warn(`Failed to parse manifest: ${manifestPath}`, err.message);
    }
  }

  return manifests;
}

function syncChainData() {
  console.log("Loading manifests...");
  const manifests = loadManifests();
  console.log(`Found ${manifests.size} manifests`);

  console.log("Loading miniapps.json...");
  const miniappsJson = JSON.parse(fs.readFileSync(MINIAPPS_JSON_PATH, "utf-8"));

  let updated = 0;
  let skipped = 0;

  // Process each category
  for (const [category, apps] of Object.entries(miniappsJson)) {
    if (!Array.isArray(apps)) continue;

    for (const app of apps) {
      const manifest = manifests.get(app.app_id);

      if (!manifest) {
        skipped++;
        continue;
      }

      // Sync supportedChains (manifest uses snake_case)
      if (manifest.supported_chains && Array.isArray(manifest.supported_chains)) {
        app.supportedChains = manifest.supported_chains;
      }

      // Sync contracts (normalize manifest contracts into host chainContracts)
      if (manifest.contracts && typeof manifest.contracts === "object") {
        const chainContracts = {};
        for (const [chainId, config] of Object.entries(manifest.contracts)) {
          if (!config || typeof config !== "object") continue;
          const address = typeof config.address === "string" ? config.address : null;
          const active = config.active !== false;
          const entryUrl =
            typeof config.entry_url === "string"
              ? config.entry_url
              : typeof config.entryUrl === "string"
                ? config.entryUrl
                : undefined;
          chainContracts[chainId] = { address, active, ...(entryUrl ? { entryUrl } : {}) };
        }
        app.chainContracts = chainContracts;
      }

      updated++;
    }
  }

  console.log(`Updated ${updated} apps, skipped ${skipped} (no manifest)`);

  // Write back
  fs.writeFileSync(MINIAPPS_JSON_PATH, JSON.stringify(miniappsJson, null, 2) + "\n");
  console.log("Saved miniapps.json");
}

syncChainData();
