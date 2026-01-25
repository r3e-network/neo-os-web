#!/usr/bin/env node
/**
 * Setup MiniApps CDN using Supabase Storage
 *
 * Usage:
 *   node scripts/setup-miniapps-cdn.js --setup        # Create storage bucket
 *   node scripts/setup-miniapps-cdn.js --upload       # Upload miniapps
 *   node scripts/setup-miniapps-cdn.js --url <appId>  # Get app URL
 *
 * Environment:
 *   SUPABASE_URL - Supabase project URL
 *   SUPABASE_SERVICE_KEY - Service role key (admin)
 *   MINAPPS_DIR - Directory containing miniapp builds (default: public/miniapps)
 */

const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");
const https = require("https");

const DEFAULT_MINAPPS_DIR = "public/miniapps";

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    action: "status",
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseKey: process.env.SUPABASE_SERVICE_KEY,
    miniappsDir: process.env.MINAPPS_DIR || DEFAULT_MINAPPS_DIR,
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--setup" || args[i] === "-s") {
      options.action = "setup";
    } else if (args[i] === "--upload" || args[i] === "-u") {
      options.action = "upload";
    } else if (args[i] === "--url" || args[i] === "-U") {
      options.action = "url";
      options.appId = args[++i];
    } else if (args[i] === "--url" || args[i] === "--dir") {
      options.miniappsDir = args[++i];
    } else if (args[i] === "--help" || args[i] === "-h") {
      console.log(`
MiniApps CDN Setup Script

Usage: node scripts/setup-miniapps-cdn.js [options]

Options:
  --setup, -s           Create storage bucket and configure
  --upload, -u          Upload all miniapps to storage
  --url <appId>, -U     Get public URL for a miniapp
  --dir <path>          Miniapps directory (default: ${DEFAULT_MINAPPS_DIR})
  --help, -h            Show this help

Environment Variables:
  SUPABASE_URL          Supabase project URL
  SUPABASE_SERVICE_KEY  Service role key (admin)
  MINAPPS_DIR           Directory with miniapp builds

Examples:
  # Setup storage bucket
  SUPABASE_URL=https://xxx.supabase.co SUPABASE_SERVICE_KEY=xxx \\
    node scripts/setup-miniapps-cdn.js --setup

  # Upload miniapps
  SUPABASE_URL=https://xxx.supabase.co SUPABASE_SERVICE_KEY=xxx \\
    node scripts/setup-miniapps-cdn.js --upload

  # Get URL for an app
  node scripts/setup-miniapps-cdn.js --url miniapp-lottery
`);
      process.exit(0);
    }
  }

  return options;
}

function getSupabaseClient(url, key) {
  return createClient(url, key);
}

async function setupBucket(supabase) {
  console.log("Creating storage bucket 'miniapps'...");

  const { data: bucket, error } = await supabase.storage.createBucket("miniapps", {
    public: true,
    allowedMimeTypes: [
      "text/html",
      "application/javascript",
      "text/css",
      "image/png",
      "image/svg+xml",
      "image/jpeg",
      "application/json",
      "font/woff2",
    ],
    fileSizeLimit: "50MB",
  });

  if (error) {
    // Bucket might already exist
    if (error.message.includes("already exists")) {
      console.log("Bucket 'miniapps' already exists");
      return true;
    }
    console.error("Error creating bucket:", error);
    return false;
  }

  console.log("Bucket created successfully:", bucket);
  return true;
}

function getAllFiles(dir) {
  const results = [];
  if (!fs.existsSync(dir)) {
    return results;
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
      results.push(...getAllFiles(fullPath));
    } else if (entry.isFile()) {
      results.push(fullPath);
    }
  }
  return results;
}

function getMimeType(file) {
  const ext = path.extname(file).toLowerCase();
  const types = {
    ".html": "text/html",
    ".js": "application/javascript",
    ".mjs": "application/javascript",
    ".css": "text/css",
    ".png": "image/png",
    ".svg": "image/svg+xml",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".json": "application/json",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
  };
  return types[ext] || "application/octet-stream";
}

async function uploadMiniApps(supabase, miniappsDir) {
  console.log(`\nUploading miniapps from: ${miniappsDir}`);

  const files = getAllFiles(miniappsDir);
  console.log(`Found ${files.length} files`);

  if (files.length === 0) {
    console.log("No files to upload. Make sure miniapps are built first.");
    return;
  }

  let success = 0;
  let failed = 0;
  const skipped = [];

  for (const file of files) {
    const relativePath = path.relative(miniappsDir, file);
    const bucketPath = `official/${relativePath}`;

    // Skip hidden files and certain patterns
    if (relativePath.includes("/.") || relativePath.startsWith(".")) {
      skipped.push(relativePath);
      continue;
    }

    try {
      const fileContent = fs.readFileSync(file);
      const { error } = await supabase.storage
        .from("miniapps")
        .upload(bucketPath, fileContent, {
          upsert: true,
          contentType: getMimeType(file),
        });

      if (error) {
        console.error(`Failed: ${relativePath}`, error.message);
        failed++;
      } else {
        console.log(`Uploaded: ${relativePath}`);
        success++;
      }
    } catch (err) {
      console.error(`Error uploading ${relativePath}:`, err);
      failed++;
    }
  }

  console.log(`\nUpload complete:`);
  console.log(`  Success: ${success}`);
  console.log(`  Failed: ${failed}`);
  console.log(`  Skipped: ${skipped.length}`);

  if (skipped.length > 0) {
    console.log("  Skipped files:", skipped.slice(0, 5).join(", ") + (skipped.length > 5 ? "..." : ""));
  }

  // Print public base URL
  const { data: urlData } = supabase.storage.from("miniapps").getPublicUrl("official");
  console.log(`\nPublic base URL: ${urlData.publicUrl}`);
}

async function getAppUrl(supabase, appId) {
  const { data: urlData } = supabase.storage
    .from("miniapps")
    .getPublicUrl(`official/${appId}/index.html`);

  console.log(`\nMiniApp URL for '${appId}':`);
  console.log(`  ${urlData.publicUrl}`);

  // Also list other available files
  const { data: files } = await supabase.storage
    .from("miniapps")
    .list(`official/${appId}`, { limit: 10 });

  if (files && files.length > 0) {
    console.log(`\nAvailable files:`);
    for (const file of files) {
      const fileUrl = supabase.storage
        .from("miniapps")
        .getPublicUrl(`official/${appId}/${file.name}`).data.publicUrl;
      console.log(`  ${file.name}: ${fileUrl}`);
    }
  }
}

async function main() {
  console.log("=".repeat(60));
  console.log("MiniApps CDN Setup Script");
  console.log("=".repeat(60));

  const options = parseArgs();

  if (!options.supabaseUrl || !options.supabaseKey) {
    console.error("\nError: SUPABASE_URL and SUPABASE_SERVICE_KEY are required");
    console.log("\nSet environment variables:");
    console.log("  export SUPABASE_URL=https://xxx.supabase.co");
    console.log("  export SUPABASE_SERVICE_KEY=xxx");
    process.exit(1);
  }

  const supabase = getSupabaseClient(options.supabaseUrl, options.supabaseKey);

  switch (options.action) {
    case "setup":
      await setupBucket(supabase);
      break;
    case "upload":
      await uploadMiniApps(supabase, options.miniappsDir);
      break;
    case "url":
      if (!options.appId) {
        console.error("Error: --url requires an appId argument");
        process.exit(1);
      }
      await getAppUrl(supabase, options.appId);
      break;
    default:
      console.log("Unknown action. Use --help for usage.");
  }
}

main().catch(console.error);
