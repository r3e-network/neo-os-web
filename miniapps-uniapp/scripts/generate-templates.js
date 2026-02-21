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

function generateApp(app) {
  const appDir = path.join(APPS_DIR, app.name);
  const srcDir = path.join(appDir, "src");

  if (!fs.existsSync(path.join(srcDir, "pages/index/index.vue"))) {
    console.log(`  [SKIP] ${app.name} - no Vue component`);
    return false;
  }

  // Create directories
  fs.mkdirSync(path.join(srcDir, "static"), { recursive: true });

  // Copy shared folder
  const sharedDest = path.join(srcDir, "shared");
  if (!fs.existsSync(sharedDest)) {
    copyDir(SHARED_DIR, sharedDest);
  }

  // Write config files
  fs.writeFileSync(path.join(appDir, "index.html"), genIndexHtml(app));
  fs.writeFileSync(path.join(appDir, "package.json"), genPackageJson(app));
  fs.writeFileSync(path.join(srcDir, "manifest.json"), genManifest(app));
  fs.writeFileSync(path.join(srcDir, "pages.json"), genPagesJson(app));
  fs.writeFileSync(path.join(appDir, "vite.config.ts"), genViteConfig(app));
  fs.writeFileSync(path.join(appDir, "tsconfig.json"), genTsConfig());
  fs.writeFileSync(path.join(srcDir, "main.ts"), genMainTs());
  fs.writeFileSync(path.join(srcDir, "App.vue"), genAppVue(app));

  console.log(`  [OK] ${app.name}`);
  return true;
}

// Main
console.log(`Generating ${APPS.length} uni-app projects...\n`);
let success = 0;
for (const app of APPS) {
  if (generateApp(app)) success++;
}
console.log(`\nDone! Generated ${success}/${APPS.length} apps.`);
