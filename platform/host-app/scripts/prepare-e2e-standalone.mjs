import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = path.join(appRoot, ".next", "standalone");
const targetRoot = path.join(appRoot, ".playwright-standalone");
const targetAppRoot = path.join(targetRoot, "platform", "host-app");

const requiredFiles = [
  "server.js",
  ".next/BUILD_ID",
  ".next/server/pages/index.html",
  ".next/server/pages/home.html",
  ".next/server/pages/miniapps.js",
  ".next/server/pages/miniapps/[id].js",
  "public/miniapp-assets/last-survivor/logo.avif",
];

function requireFile(root, relativePath) {
  const candidate = path.join(root, relativePath);
  if (!fs.existsSync(candidate)) {
    throw new Error(`[prepare-e2e-standalone] missing ${relativePath} in ${root}`);
  }
}

if (!fs.existsSync(sourceRoot)) {
  throw new Error(`[prepare-e2e-standalone] missing source standalone root: ${sourceRoot}`);
}

for (const relativePath of requiredFiles) {
  requireFile(path.join(sourceRoot, "platform", "host-app"), relativePath);
}

fs.rmSync(targetRoot, { recursive: true, force: true });
fs.mkdirSync(path.dirname(targetRoot), { recursive: true });
fs.cpSync(sourceRoot, targetRoot, { recursive: true, dereference: true });

for (const relativePath of requiredFiles) {
  requireFile(targetAppRoot, relativePath);
}

console.log(`[prepare-e2e-standalone] copied ${sourceRoot} -> ${targetRoot}`);
