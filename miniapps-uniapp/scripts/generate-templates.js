#!/usr/bin/env node
/**
 * Main generator - creates all uni-app project files
 */
const fs = require("fs");
const path = require("path");
const { genPackageJson, genManifest, genPagesJson } = require("./templates/json-templates");
const { genViteConfig, genTsConfig } = require("./templates/config-templates");
const { genIndexHtml, genMainTs, genAppVue } = require("./templates/vue-templates");
const { APPS_DIR, APPS } = require("./app-config");

const SHARED_DIR = path.join(__dirname, "../shared");

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const item of fs.readdirSync(src)) {
    const srcPath = path.join(src, item);
    const destPath = path.join(dest, item);
    if (fs.statSync(srcPath).isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function buildFileSpecs(appDir, srcDir, app) {
  return [
    { path: path.join(appDir, "index.html"), content: genIndexHtml(app) },
    { path: path.join(appDir, "package.json"), content: genPackageJson(app) },
    { path: path.join(srcDir, "manifest.json"), content: genManifest(app) },
    { path: path.join(srcDir, "pages.json"), content: genPagesJson(app) },
    { path: path.join(appDir, "vite.config.ts"), content: genViteConfig(app) },
    { path: path.join(appDir, "tsconfig.json"), content: genTsConfig() },
    { path: path.join(srcDir, "main.ts"), content: genMainTs() },
    { path: path.join(srcDir, "App.vue"), content: genAppVue(app) },
  ];
}

function writeFileSpecs(fileSpecs) {
  for (const file of fileSpecs) {
    fs.writeFileSync(file.path, file.content);
  }
}

function ensureSharedSources(srcDir) {
  const sharedDest = path.join(srcDir, "shared");
  if (!fs.existsSync(sharedDest)) {
    copyDir(SHARED_DIR, sharedDest);
  }
}

function generateApp(app) {
  const appDir = path.join(APPS_DIR, app.name);
  const srcDir = path.join(appDir, "src");

  if (!fs.existsSync(path.join(srcDir, "pages/index/index.vue"))) {
    console.log(`  [SKIP] ${app.name} - no Vue component`);
    return false;
  }

  fs.mkdirSync(path.join(srcDir, "static"), { recursive: true });
  ensureSharedSources(srcDir);
  writeFileSpecs(buildFileSpecs(appDir, srcDir, app));

  console.log(`  [OK] ${app.name}`);
  return true;
}

console.log(`Generating ${APPS.length} uni-app projects...\n`);
let success = 0;
for (const app of APPS) {
  if (generateApp(app)) success++;
}
console.log(`\nDone! Generated ${success}/${APPS.length} apps.`);
