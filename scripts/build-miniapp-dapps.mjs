#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const appsRoot = path.join(repoRoot, "apps");
const archivedSlugs = new Set(["flamingo", "flaminggo", "neoburger", "neo-burger"]);
const selected = new Set(process.argv.slice(2).filter((arg) => !arg.startsWith("-")));

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function runBuild(slug, appDir) {
  return new Promise((resolve) => {
    const child = spawn("npm", ["--prefix", appDir, "run", "-s", "build"], {
      cwd: repoRoot,
      stdio: "pipe",
      env: process.env,
    });
    let output = "";
    child.stdout.on("data", (chunk) => { output += chunk.toString(); });
    child.stderr.on("data", (chunk) => { output += chunk.toString(); });
    child.on("close", (code) => {
      resolve({ slug, code, output });
    });
  });
}

async function main() {
  const entries = await fs.readdir(appsRoot, { withFileTypes: true });
  const apps = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (!entry.isDirectory() || entry.name === "shared") continue;
    const slug = entry.name;
    if (archivedSlugs.has(slug)) continue;
    if (selected.size > 0 && !selected.has(slug)) continue;
    const appDir = path.join(appsRoot, slug);
    if (!(await exists(path.join(appDir, "neo-manifest.json")))) continue;
    if (!(await exists(path.join(appDir, "package.json")))) continue;
    apps.push({ slug, appDir });
  }

  const failures = [];
  for (const app of apps) {
    process.stdout.write(`[miniapp-build] ${app.slug}\n`);
    const result = await runBuild(app.slug, app.appDir);
    if (result.code !== 0) {
      failures.push({
        slug: result.slug,
        code: result.code,
        tail: result.output.split(/\r?\n/).slice(-40).join("\n"),
      });
      process.stdout.write(`[miniapp-build] ${app.slug} failed\n`);
      continue;
    }
    process.stdout.write(`[miniapp-build] ${app.slug} ok\n`);
  }

  console.log(JSON.stringify({
    built_count: apps.length - failures.length,
    failure_count: failures.length,
    failures,
  }, null, 2));

  if (failures.length > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exit(1);
});
