#!/usr/bin/env node
/**
 * Fetch miniapp registry from external miniapps repository
 *
 * This script syncs the miniapp registry from the official miniapps repository
 * to ensure the platform has the latest official miniapps.
 *
 * Usage:
 *   node scripts/sync-miniapps-from-repo.js [--output path] [--token github-token]
 *
 * Environment:
 *   MINIAPPS_REPO_URL - URL of the miniapps repository (default: git@github.com:r3e-network/miniapps.git)
 *   GITHUB_TOKEN - GitHub token for private repos
 */

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const https = require("https");

const DEFAULT_REPO_URL = "https://github.com/r3e-network/miniapps.git";
const DEFAULT_OUTPUT = "platform/host-app/data/miniapps.json";
const REGISTRY_FILE = "miniapps.json";

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    output: DEFAULT_OUTPUT,
    token: process.env.GITHUB_TOKEN || "",
    repoUrl: process.env.MINIAPPS_REPO_URL || DEFAULT_REPO_URL,
    branch: "main",
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--output" || args[i] === "-o") {
      options.output = args[++i] || options.output;
    } else if (args[i] === "--token" || args[i] === "-t") {
      options.token = args[++i] || options.token;
    } else if (args[i] === "--repo" || args[i] === "-r") {
      options.repoUrl = args[++i] || options.repoUrl;
    } else if (args[i] === "--branch" || args[i] === "-b") {
      options.branch = args[++i] || options.branch;
    } else if (args[i] === "--help" || args[i] === "-h") {
      console.log(`
Sync MiniApps Registry from External Repository

Usage: node scripts/sync-miniapps-from-repo.js [options]

Options:
  --output, -o <path>  Output file path (default: ${DEFAULT_OUTPUT})
  --token, -t <token>  GitHub token for private repos
  --repo, -r <url>     Repository URL (default: ${DEFAULT_REPO_URL})
  --branch, -b <name>  Branch name (default: main)
  --help, -h           Show this help message

Environment Variables:
  MINIAPPS_REPO_URL  Repository URL
  GITHUB_TOKEN       GitHub token for private repos

Example:
  # Using defaults
  node scripts/sync-miniapps-from-repo.js

  # Custom output
  node scripts/sync-miniapps-from-repo.js -o custom/miniapps.json

  # Private repo
  GITHOTOKEN=ghp_xxx node scripts/sync-miniapps-from-repo.js
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

async function fetchRegistryFromGitHub(repoUrl, branch, token, outputPath) {
  // Convert git URL to GitHub API URL
  let owner, repo;
  
  if (repoUrl.includes("github.com")) {
    const match = repoUrl.match(/github\.com[/:]([^/]+)\/([^/]+)\.git$/);
    if (!match) {
      // Try without .git suffix
      const altMatch = repoUrl.match(/github\.com[/:]([^/]+)\/([^/]+)$/);
      if (!altMatch) throw new Error(`Invalid GitHub URL: ${repoUrl}`);
      [, owner, repo] = altMatch;
    } else {
      [, owner, repo] = match;
    }
  } else {
    throw new Error("Only GitHub repositories are supported");
  }

  repo = repo.replace(/\.git$/, "");

  // Fetch the raw miniapps.json file
  const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${REGISTRY_FILE}`;
  console.log(`Fetching registry from: ${rawUrl}`);

  try {
    const content = await downloadFile(rawUrl, token);
    
    // Validate JSON
    const data = JSON.parse(content);
    
    if (!data.gaming || !Array.isArray(data.gaming)) {
      throw new Error("Invalid registry format: missing gaming array");
    }

    // Count apps
    const categories = Object.keys(data);
    let totalApps = 0;
    for (const cat of categories) {
      if (Array.isArray(data[cat])) {
        totalApps += data[cat].length;
      }
    }

    console.log(`Found ${totalApps} miniapps across ${categories.length} categories`);

    // Ensure output directory exists
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Write to output file
    fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));
    console.log(`Registry saved to: ${outputPath}`);

    return { success: true, appsCount: totalApps, categories };
  } catch (error) {
    if (error.code === "ENOTFOUND" || error.message.includes("getaddrinfo")) {
      throw new Error(`Network error: Could not reach ${rawUrl}`);
    }
    throw error;
  }
}

async function main() {
  console.log("=".repeat(60));
  console.log("Syncing MiniApps Registry from External Repository");
  console.log("=".repeat(60));

  const options = parseArgs();

  try {
    const result = await fetchRegistryFromGitHub(
      options.repoUrl,
      options.branch,
      options.token,
      options.output
    );

    console.log("\n" + "=".repeat(60));
    console.log("Sync Complete!");
    console.log(`- Total MiniApps: ${result.appsCount}`);
    console.log(`- Categories: ${result.categories.join(", ")}`);
    console.log("=".repeat(60));
  } catch (error) {
    console.error("\nError:", error.message);
    console.error("\nTroubleshooting:");
    console.error("- Check that the repository URL is correct");
    console.error("- Ensure the branch exists");
    console.error("- For private repos, provide a GitHub token");
    process.exit(1);
  }
}

main();
