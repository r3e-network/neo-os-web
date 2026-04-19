#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "../..");
const APPS_DIR = path.join(ROOT, "apps");
const ACCEPTED_MARKERS = [
  "<MiniAppPage",
  "<OfficialLauncherMiniApp",
  "<ConsoleMiniApp",
];

function hasAcceptedLayout(filePath) {
  const source = fs.readFileSync(filePath, "utf8");
  return ACCEPTED_MARKERS.some((marker) => source.includes(marker));
}

function hasCurrentRuntimeLayout(appRoot) {
  // The platform migrated from Vue 3 (*.vue + src/main.ts) to React
  // (*.tsx + src/main.tsx) in late-2025. Accept either shape — both
  // still use the shared defineMiniApp(...) contract.
  const candidates = [
    { main: "main.tsx", play: "PlayArea.tsx" },
    { main: "main.ts",  play: "PlayArea.vue" },
  ];
  for (const { main, play } of candidates) {
    const mainPath = path.join(appRoot, "src", main);
    const playPath = path.join(appRoot, "src", play);
    if (!fs.existsSync(mainPath) || !fs.existsSync(playPath)) continue;
    const mainSource = fs.readFileSync(mainPath, "utf8");
    if (mainSource.includes("defineMiniApp(")) return true;
  }
  return false;
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
    const appRoot = path.join(APPS_DIR, app);
    const srcRoot = path.join(appRoot, "src");
    const pagePath = path.join(appRoot, "src/pages/index/index.vue");

    if (!fs.existsSync(srcRoot)) {
      continue;
    }

    checked.push(app);

    if (hasCurrentRuntimeLayout(appRoot)) {
      continue;
    }

    if (!fs.existsSync(pagePath)) {
      failed.push(app);
      continue;
    }

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
