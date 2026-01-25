#!/usr/bin/env node
/**
 * Sync miniapp registry from external repo and update CDN URLs
 *
 * Usage:
 *   node scripts/sync-miniapps-with-cdn.js --repo <url> --branch <name> --cdn <url>
 *
 * Environment:
 *   MINIAPPS_REPO_URL - URL of miniapps repository
 *   MINIAPPS_CDN_URL - Base URL for CDN (e.g., https://miniapps.vercel.app)
 *   GITHUB_TOKEN - GitHub token for private repos
 */

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const https = require("https");

const DEFAULT_OUTPUT = "platform/host-app/data/miniapps.json";
const REGISTRY_FILE = "miniapps.json";

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    output: process.env.MINIAPPS_OUTPUT_PATH || DEFAULT_OUTPUT,
    repoUrl: process.env.MINIAPPS_REPO_URL || "https://github.com/r3e-network/miniapps.git",
    cdnUrl: process.env.MINIAPPS_CDN_URL || "",
    branch: "main",
    token: process.env.GITHUB_TOKEN || "",
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--output" || args[i] === "-o") {
      options.output = args[++i] || options.output;
    } else if (args[i] === "--repo" || args[i] === "-r") {
      options.repoUrl = args[++i] || options.repoUrl;
    } else if (args[i] === "--cdn" || args[i] === "-c") {
      options.cdnUrl = args[++i] || options.cdnUrl;
    } else if (args[i] === "--branch" || args[i] === "-b") {
      options.branch = args[++i] || options.branch;
    } else if (args[i] === "--token" || args[i] === "-t") {
      options.token = args[++i] || options.token;
    } else if (args[i] === "--help" || args[i] === "-h") {
      console.log(`
Sync MiniApps Registry with CDN URLs

Usage: node scripts/sync-miniapps-with-cdn.js [options]

Options:
  --output, -o <path>   Output file (default: ${DEFAULT_OUTPUT})
  --repo, -r <url>      Repository URL (default: ${options.repoUrl})
  --cdn, -c <url>       CDN base URL (e.g., https://miniapps.vercel.app)
  --branch, -b <name>   Branch name (default: main)
  --token, -t <token>   GitHub token for private repos
  --help, -h            Show this help

Environment Variables:
  MINIAPPS_REPO_URL     Repository URL
  MINIAPPS_CDN_URL      CDN base URL
  MINIAPPS_OUTPUT_PATH  Output file path
  GITHUB_TOKEN          GitHub token

Example:
  # Sync from public repo with Vercel CDN
  MINIAPPS_CDN_URL=https://miniapps.vercel.app \\
    node scripts/sync-miniapps-with-cdn.js

  # Sync from private repo
  GITHUB_TOKEN=ghp_xxx \\
  MINIAPPS_REPO_URL=https://github.com/org/private-miniapps.git \\
  MINIAPPS_CDN_URL=https://private-miniapps.vercel.app \\
    node scripts/sync-miniapps-with-cdn.js
`);
      process.exit(0);
    }
  }

  return options;
}

function downloadFile(url, token) {
  return new Promise((resolve, reject) => {
    const headers = {};
    if (token) {
      headers.Authorization = `token ${token}`;
    }

    https.get(url, { headers }, (res) => {
      if (res.statusCode === 302 || res.statusCode === 301) {
        downloadFile(res.headers.location, token).then(resolve).catch(reject);
        return;
      }

      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => resolve(data));
      res.on("error", reject);
    }).on("error", reject);
  });
}

function extractAppIdFromPath(entryUrl) {
  // Extract app folder name from /miniapps/<app-id>/index.html
  const match = entryUrl.match(/\/miniapps\/([^/]+)\//);
  return match ? match[1] : null;
}

function updateCdnUrls(data, cdnBaseUrl) {
  if (!cdnBaseUrl) {
    console.log("No CDN URL provided, keeping original URLs");
    return data;
  }

  const categories = Object.keys(data);
  let updated = 0;

  for (const category of categories) {
    if (!Array.isArray(data[category])) continue;

    for (const app of data[category]) {
      const appId = extractAppIdFromPath(app.entry_url);
      
      if (appId) {
        // Update entry_url to CDN URL
        const oldUrl = app.entry_url;
        const newUrl = `${cdnBaseUrl}/${appId}/index.html`;
        
        if (oldUrl !== newUrl) {
          app.entry_url = newUrl;
          
          // Update icon and banner paths if they're local
          if (app.icon && app.icon.startsWith("/miniapps/")) {
            app.icon = `${cdnBaseUrl}/${appId}${app.icon.split(appId)[1]}`;
          }
          if (app.banner && app.banner.startsWith("/miniapps/")) {
            app.banner = `${cdnBaseUrl}/${appId}${app.banner.split(appId)[1]}`;
          }
          
          // Update chainContracts entry URLs if they exist
          if (app.chainContracts) {
            for (const chainId of Object.keys(app.chainContracts)) {
              if (app.chainContracts[chainId].entryUrl?.startsWith("/miniapps/")) {
                app.chainContracts[chainId].entryUrl = `${cdnBaseUrl}/${appId}/index.html?chain=${chainId}`;
              }
            }
          }
          
          updated++;
        }
      }
    }
  }

  console.log(`Updated ${updated} app URLs to use CDN`);
  return data;
}

async function fetchAndSync(options) {
  // Convert git URL to raw GitHub URL
  let owner, repo;
  const urlMatch = options.repoUrl.match(/github\.com[/:]([^/]+)\/([^/]+)/);
  if (!urlMatch) {
    throw new Error(`Invalid GitHub URL: ${options.repoUrl}`);
  }
  [, owner, repo] = urlMatch;
  repo = repo.replace(/\.git$/, "");

  const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${options.branch}/${REGISTRY_FILE}`;
  console.log(`Fetching registry from: ${rawUrl}`);

  const content = await downloadFile(rawUrl, options.token);
  const data = JSON.parse(content);

  // Update CDN URLs
  const updatedData = updateCdnUrls(data, options.cdnUrl);

  // Count apps
  let totalApps = 0;
  for (const cat of Object.keys(updatedData)) {
    if (Array.isArray(updatedData[cat])) {
      totalApps += updatedData[cat].length;
    }
  }

  console.log(`Found ${totalApps} miniapps across ${Object.keys(updatedData).length} categories`);

  // Ensure output directory exists
  const outputDir = path.dirname(options.output);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Write to output file
  fs.writeFileSync(options.output, JSON.stringify(updatedData, null, 2));
  console.log(`Registry saved to: ${options.output}`);

  // Print sample URLs
  console.log("\nSample CDN URLs:");
  const firstApp = updatedData[Object.keys(updatedData)[0]]?.[0];
  if (firstApp) {
    console.log(`  Entry: ${firstApp.entry_url}`);
    console.log(`  Icon: ${firstApp.icon}`);
  }

  return { success: true, appsCount: totalApps };
}

async function main() {
  console.log("=".repeat(60));
  console.log("Syncing MiniApps Registry with CDN URLs");
  console.log("=".repeat(60));

  const options = parseArgs();

  if (!options.cdnUrl) {
    console.log("\nWarning: No CDN URL provided. URLs will not be updated.");
    console.log("Set MINIAPPS_CDN_URL environment variable or use --cdn flag.\n");
  }

  try {
    const result = await fetchAndSync(options);

    console.log("\n" + "=".repeat(60));
    console.log("Sync Complete!");
    console.log(`- Total MiniApps: ${result.appsCount}`);
    console.log(`- CDN Base URL: ${options.cdnUrl || "not set"}`);
    console.log("=".repeat(60));
  } catch (error) {
    console.error("\nError:", error.message);
    process.exit(1);
  }
}

main();
