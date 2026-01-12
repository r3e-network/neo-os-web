#!/usr/bin/env node
/**
 * Auto-discover MiniApps (wrapper)
 *
 * Keep a single source of truth for registry generation.
 * This wrapper delegates to the miniapps-uniapp script.
 */

const path = require("path");
const { execFileSync } = require("child_process");

function main() {
  const scriptPath = path.join(__dirname, "../../../miniapps-uniapp/scripts/auto-discover-miniapps.js");
  execFileSync(process.execPath, [scriptPath], { stdio: "inherit" });
}

if (require.main === module) {
  main();
}
