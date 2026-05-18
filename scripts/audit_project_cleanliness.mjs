#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const findings = [];
const warnings = [];

function rel(file) {
  return path.relative(ROOT, file);
}

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), "utf8");
}

function exists(file) {
  return fs.existsSync(path.join(ROOT, file));
}

function add(kind, file, message) {
  findings.push({ kind, file, message });
}

function warn(kind, file, message) {
  warnings.push({ kind, file, message });
}

function git(args) {
  return execFileSync("git", args, {
    cwd: ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function listManifestFiles() {
  const appsDir = path.join(ROOT, "apps");
  return fs
    .readdirSync(appsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(appsDir, entry.name, "neo-manifest.json"))
    .filter((file) => fs.existsSync(file))
    .sort();
}

function auditGitIgnore() {
  const gitignore = read(".gitignore");
  if (!gitignore.includes(".automation-logs/")) {
    add("gitignore", ".gitignore", "missing .automation-logs/ ignore rule");
  }

  try {
    execFileSync("git", ["check-ignore", "-q", ".automation-logs/placeholder.log"], {
      cwd: ROOT,
    });
  } catch {
    add("gitignore", ".gitignore", ".automation-logs is not ignored by git");
  }
}

function auditTrackedBuildOutputs() {
  const tracked = git(["ls-files"])
    .split("\n")
    .filter(Boolean)
    .filter((file) =>
      /(^|\/)(node_modules|dist|\.next|coverage|\.automation-logs)(\/|$)/.test(
        file,
      ) ||
        /(^|\/)(test-results|playwright-report|\.vercel)(\/|$)/.test(file),
    );

  for (const file of tracked) {
    add("tracked-output", file, "generated output is tracked");
  }
}

function shouldSkipLocalArtifactDir(relativePath) {
  return (
    relativePath === "node_modules" ||
    relativePath.includes("/node_modules/") ||
    relativePath === ".git" ||
    relativePath.startsWith(".git/")
  );
}

function listDirs(root, predicate) {
  const results = [];
  const stack = [root];
  while (stack.length > 0) {
    const dir = stack.pop();
    const relativeDir = rel(dir);
    if (shouldSkipLocalArtifactDir(relativeDir)) continue;

    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const full = path.join(dir, entry.name);
      const relative = rel(full);
      if (shouldSkipLocalArtifactDir(relative)) continue;
      if (predicate(relative, entry.name)) {
        results.push(relative);
        continue;
      }
      stack.push(full);
    }
  }
  return results.sort();
}

function auditLocalGeneratedResidue() {
  const generatedDirs = listDirs(ROOT, (relative, name) => {
    if ([".next", ".vercel", "test-results", "playwright-report", "coverage"].includes(name)) {
      return true;
    }
    if (name === "dist" && !relative.startsWith("node_modules/")) {
      return true;
    }
    return false;
  });

  for (const dir of generatedDirs.slice(0, 25)) {
    warn("local-output", dir, "ignored local generated output is present");
  }
  if (generatedDirs.length > 25) {
    warn(
      "local-output",
      ".",
      `${generatedDirs.length - 25} additional ignored generated directories are present`,
    );
  }
}

function auditMiniappCatalogDocs() {
  const manifests = listManifestFiles();
  const categories = new Map();
  for (const manifestFile of manifests) {
    const manifest = JSON.parse(fs.readFileSync(manifestFile, "utf8"));
    const category = String(manifest.category || "uncategorized");
    categories.set(category, (categories.get(category) || 0) + 1);
  }

  const readme = read("README.md");
  const expectedCountLine = `**${manifests.length} Neo N3 miniapp manifests**`;
  if (!readme.includes(expectedCountLine)) {
    add(
      "docs",
      "README.md",
      `miniapp manifest count is stale; expected ${expectedCountLine}`,
    );
  }

  for (const [category, count] of [...categories.entries()].sort()) {
    const expectedLine = `- \`${category}\`: ${count}`;
    if (!readme.includes(expectedLine)) {
      add("docs", "README.md", `missing current category spread line: ${expectedLine}`);
    }
  }
}

function auditServiceSurfaceDocs() {
  const osFunctionCount = fs
    .readdirSync(path.join(ROOT, "platform/edge/functions"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith("os-")).length;

  const proxyFiles = fs
    .readdirSync(path.join(ROOT, "apps/shared/services/os"), { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter(
      (name) =>
        name.endsWith("Proxy.ts") &&
        !["OSServiceProxy.ts"].includes(name),
    );

  const expectedBinderText = `${osFunctionCount} OS Binder`;
  const expectedProxyText = `${proxyFiles.length} typed frontend OS proxy`;
  for (const file of ["README.md", "docs/ARCHITECTURE.md"]) {
    const text = read(file);
    if (!text.includes(expectedBinderText)) {
      add("docs", file, `expected service surface text: ${expectedBinderText}`);
    }
    if (!text.includes(expectedProxyText)) {
      add("docs", file, `expected proxy surface text: ${expectedProxyText}`);
    }
  }
}

function auditStaleArchitectureTerms() {
  const stalePatterns = [
    /46 Neo N3 miniapp manifests/,
    /45 OS/,
    /10 OS (system service contracts|service contracts|proxy classes)/,
    /contracts\/os-/,
    /MiniAppTemplates/,
    /Template Marketplace/,
    /Auth0/,
  ];
  const files = [
    "README.md",
    "docs/ARCHITECTURE.md",
    "platform/README.md",
    "contracts/README.md",
  ];

  for (const file of files) {
    const text = read(file);
    for (const pattern of stalePatterns) {
      if (pattern.test(text)) {
        add("docs", file, `stale architecture wording matched ${pattern}`);
      }
    }
  }
}

function auditContractFileSize() {
  const contractDir = path.join(ROOT, "contracts");
  const stack = [contractDir];
  while (stack.length > 0) {
    const dir = stack.pop();
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "bin" || entry.name === "obj") continue;
        stack.push(full);
      } else if (entry.isFile() && entry.name.endsWith(".cs")) {
        const lineCount = fs.readFileSync(full, "utf8").split("\n").length;
        if (lineCount > 700) {
          add(
            "contract-size",
            rel(full),
            `C# source has ${lineCount} lines; split into partial files`,
          );
        }
      }
    }
  }
}

function auditLargeFrontendFiles() {
  const sourceRoots = ["apps", "platform/host-app", "platform/admin-console", "platform/sdk"];
  const skippedSegments = new Set(["node_modules", "dist", "build", ".next", "coverage"]);
  const skippedFiles = [
    "apps/shared/shims/",
    "apps/on-chain-tarot/public/cards/",
  ];
  const stack = sourceRoots
    .map((dir) => path.join(ROOT, dir))
    .filter((dir) => fs.existsSync(dir));

  while (stack.length > 0) {
    const dir = stack.pop();
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      const relative = rel(full);
      if (entry.isDirectory()) {
        if (skippedSegments.has(entry.name)) continue;
        stack.push(full);
        continue;
      }
      if (!entry.isFile() || !/\.(tsx?|jsx?|mjs)$/.test(entry.name)) continue;
      if (skippedFiles.some((prefix) => relative.startsWith(prefix))) continue;

      const lineCount = fs.readFileSync(full, "utf8").split("\n").length;
      if (lineCount > 1000) {
        warn(
          "source-size",
          relative,
          `frontend/source file has ${lineCount} lines; consider splitting by domain`,
        );
      }
    }
  }
}

function auditExpectedDirectories() {
  for (const dir of [
    "apps/shared/services/os",
    "contracts/platform/PlatformAnchor",
    "contracts/platform/PlatformDeFi",
    "contracts/platform/PlatformGame",
    "contracts/platform/PlatformSocial",
    "platform/edge/functions",
    "platform/host-app",
    "platform/admin-console",
  ]) {
    if (!exists(dir)) {
      add("structure", dir, "expected project layer is missing");
    }
  }
}

auditGitIgnore();
auditTrackedBuildOutputs();
auditLocalGeneratedResidue();
auditMiniappCatalogDocs();
auditServiceSurfaceDocs();
auditStaleArchitectureTerms();
auditContractFileSize();
auditLargeFrontendFiles();
auditExpectedDirectories();

const summary = {
  ok: findings.length === 0,
  miniapps: listManifestFiles().length,
  osBinderFunctions: fs
    .readdirSync(path.join(ROOT, "platform/edge/functions"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith("os-")).length,
  findings,
  warnings,
};

console.log(JSON.stringify(summary, null, 2));

if (findings.length > 0) {
  process.exit(1);
}
