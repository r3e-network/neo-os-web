#!/usr/bin/env node
/**
 * Auto-discover MiniApps from miniapps-uniapp/apps directory
 *
 * This script scans the miniapps directory and automatically generates
 * the miniapps.json data file, enabling zero-config miniapp registration.
 *
 * Each miniapp only needs a neo-manifest.json file in its root directory.
 */

const fs = require("fs");
const path = require("path");

const MINIAPPS_DIR = path.join(__dirname, "../../../miniapps-uniapp/apps");
const OUTPUT_FILE = path.join(__dirname, "../data/miniapps.json");

// Category order for consistent output
const CATEGORY_ORDER = ["gaming", "defi", "social", "nft", "governance", "utility"];

// Default icon based on category
const DEFAULT_ICONS = {
  gaming: "🎮",
  defi: "💰",
  social: "👥",
  nft: "🎨",
  governance: "🏛️",
  utility: "🔧",
};

function discoverMiniApps() {
  const apps = {
    gaming: [],
    defi: [],
    social: [],
    nft: [],
    governance: [],
    utility: [],
  };

  // Get all directories in miniapps folder
  const appDirs = fs
    .readdirSync(MINIAPPS_DIR, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory() && !dirent.name.startsWith("."))
    .map((dirent) => dirent.name);

  console.log(`Found ${appDirs.length} miniapp directories`);

  for (const appDir of appDirs) {
    const manifestPath = path.join(MINIAPPS_DIR, appDir, "neo-manifest.json");

    // Check if neo-manifest.json exists
    if (!fs.existsSync(manifestPath)) {
      console.warn(`  [SKIP] ${appDir}: no neo-manifest.json found`);
      continue;
    }

    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

      // Validate required fields
      if (!manifest.category) {
        console.warn(`  [SKIP] ${appDir}: missing category in manifest`);
        continue;
      }

      // Generate app_id from directory name
      const appId = `miniapp-${appDir.replace(/-/g, "")}`;

      // Build app entry
      const appEntry = {
        app_id: appId,
        name: manifest.name || formatName(appDir),
        name_zh: manifest.name_zh || manifest.name || formatName(appDir),
        description: manifest.description || `${formatName(appDir)} MiniApp`,
        description_zh: manifest.description_zh || manifest.description || `${formatName(appDir)} 小程序`,
        icon: `/miniapps/${appDir}/static/icon.svg`,
        entry_url: `/miniapps/${appDir}/index.html`,
        status: manifest.status || "active",
        contract_hash: manifest.contract_hash || null,
        permissions: manifest.permissions || {},
      };

      // Add to appropriate category
      const category = manifest.category.toLowerCase();
      if (apps[category]) {
        apps[category].push(appEntry);
        console.log(`  [OK] ${appDir} -> ${category}`);
      } else {
        console.warn(`  [SKIP] ${appDir}: unknown category "${category}"`);
      }
    } catch (err) {
      console.error(`  [ERROR] ${appDir}: ${err.message}`);
    }
  }

  return apps;
}

function formatName(dirName) {
  return dirName
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function main() {
  console.log("Auto-discovering MiniApps...\n");

  const apps = discoverMiniApps();

  // Count total apps
  const totalApps = Object.values(apps).reduce((sum, arr) => sum + arr.length, 0);

  console.log(`\nDiscovered ${totalApps} MiniApps:`);
  for (const [category, categoryApps] of Object.entries(apps)) {
    console.log(`  ${category}: ${categoryApps.length}`);
  }

  // Write output file
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(apps, null, 2));
  console.log(`\nWritten to ${OUTPUT_FILE}`);
}

if (require.main === module) {
  main();
}

module.exports = { discoverMiniApps };
