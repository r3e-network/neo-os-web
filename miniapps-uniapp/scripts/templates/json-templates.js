#!/usr/bin/env node
/**
 * Template generators for uni-app projects
 */
const fs = require("fs");
const path = require("path");

// Generate package.json
function genPackageJson(app) {
  return JSON.stringify(
    {
      name: app.appId,
      version: "1.0.0",
      private: true,
      scripts: {
        dev: "uni",
        "build:h5": "uni build -p h5",
        build: "uni build -p h5",
      },
      dependencies: {
        vue: "^3.4.21",
        "@dcloudio/uni-app": "3.0.0-4060620250520001",
        "@dcloudio/uni-h5": "3.0.0-4060620250520001",
        "@dcloudio/uni-components": "3.0.0-4060620250520001",
        "@neo/uniapp-sdk": "file:../../packages/@neo/uniapp-sdk",
      },
      devDependencies: {
        "@dcloudio/uni-cli-shared": "3.0.0-4060620250520001",
        "@dcloudio/vite-plugin-uni": "3.0.0-4060620250520001",
        typescript: "^5.4.5",
        vite: "^5.2.8",
        sass: "^1.77.0",
      },
    },
    null,
    2,
  );
}

// Generate manifest.json
function genManifest(app) {
  return JSON.stringify(
    {
      name: app.title,
      appid: app.appId,
      description: `${app.title} - Neo MiniApp`,
      versionName: "1.0.0",
      versionCode: "100",
      transformPx: false,
      h5: {
        title: app.title,
        router: { mode: "hash" },
        devServer: { port: 5173 },
      },
    },
    null,
    2,
  );
}

// Generate pages.json
function genPagesJson(app) {
  return JSON.stringify(
    {
      pages: [{ path: "pages/index/index", style: { navigationBarTitleText: app.title } }],
      globalStyle: {
        navigationBarTextStyle: "white",
        navigationBarTitleText: app.title,
        navigationBarBackgroundColor: "#0d1117",
        backgroundColor: "#0d1117",
      },
    },
    null,
    2,
  );
}

module.exports = { genPackageJson, genManifest, genPagesJson };
