#!/usr/bin/env node
/**
 * Migration script to add supportedChains field to all miniapps
 * This is a one-time migration for existing Neo N3 apps
 */

const fs = require("fs");
const path = require("path");

const miniappsPath = path.join(__dirname, "../data/miniapps.json");
const data = JSON.parse(fs.readFileSync(miniappsPath, "utf8"));

// Chains to assign to existing Neo N3 apps during migration
const MIGRATION_CHAINS = ["neo-n3-mainnet"];

// Process each category
for (const category of Object.keys(data)) {
  if (Array.isArray(data[category])) {
    for (const app of data[category]) {
      // Add supportedChains if not present
      if (!app.supportedChains) {
        app.supportedChains = [...MIGRATION_CHAINS];
      }
    }
  }
}

// Write back
fs.writeFileSync(miniappsPath, JSON.stringify(data, null, 2) + "\n");
console.log("✅ Added supportedChains to all miniapps");
