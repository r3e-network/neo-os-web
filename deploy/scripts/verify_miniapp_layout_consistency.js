#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "../..");
const APPS_DIR = path.join(ROOT, "apps");
const ACCEPTED_MARKERS = [
  "<MiniAppPage",
  "<OfficialLauncherMiniApp",
];

function hasAcceptedLayout(filePath) {
  const source = fs.readFileSync(filePath, "utf8");
  return ACCEPTED_MARKERS.some((marker) => source.includes(marker));
}

function main() {
  const entries = fs.readdirSync(APPS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => name !== "shared")
    .sort();

  const checked = [];
  const failed = [];

  for (const app of entries) {
    const pagePath = path.join(APPS_DIR, app, "src/pages/index/index.vue");
    if (!fs.existsSync(pagePath)) continue;
    checked.push(app);
    if (!hasAcceptedLayout(pagePath)) {
      failed.push(app);
    }
  }

  console.log(JSON.stringify({
    checked_count: checked.length,
    accepted_markers: ACCEPTED_MARKERS,
    failed,
  }, null, 2));

  if (failed.length > 0) {
    process.exit(1);
  }
}

main();
