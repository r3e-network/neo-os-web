#!/usr/bin/env node
/**
 * Template generators for uni-app projects
 */

const UNI_VERSION = "3.0.0-4060620250520001";

const BASE_PACKAGE = {
  version: "1.0.0",
  private: true,
  scripts: {
    dev: "uni",
    "build:h5": "uni build -p h5",
    build: "uni build -p h5",
  },
  dependencies: {
    vue: "^3.4.21",
    "@dcloudio/uni-app": UNI_VERSION,
    "@dcloudio/uni-h5": UNI_VERSION,
    "@dcloudio/uni-components": UNI_VERSION,
    "@neo/uniapp-sdk": "file:../../packages/@neo/uniapp-sdk",
  },
  devDependencies: {
    "@dcloudio/uni-cli-shared": UNI_VERSION,
    "@dcloudio/vite-plugin-uni": UNI_VERSION,
    typescript: "^5.4.5",
    vite: "^5.2.8",
    sass: "^1.77.0",
  },
};

const BASE_MANIFEST = {
  versionName: "1.0.0",
  versionCode: "100",
  transformPx: false,
};

const BASE_H5 = {
  router: { mode: "hash" },
  devServer: { port: 5173 },
};

const BASE_GLOBAL_STYLE = {
  navigationBarTextStyle: "white",
  navigationBarBackgroundColor: "#0d1117",
  backgroundColor: "#0d1117",
};

const CATEGORY_NAV_BG = {
  gaming: "#18102a",
  defi: "#10221d",
  social: "#2a1210",
  nft: "#102028",
  governance: "#262018",
  utility: "#1b1f27",
};

function pickCategoryColor(category) {
  return CATEGORY_NAV_BG[category] || BASE_GLOBAL_STYLE.navigationBarBackgroundColor;
}

// Generate package.json
function genPackageJson(app) {
  const pkg = {
    ...BASE_PACKAGE,
    name: app.appId,
    scripts: { ...BASE_PACKAGE.scripts },
    dependencies: { ...BASE_PACKAGE.dependencies },
    devDependencies: { ...BASE_PACKAGE.devDependencies },
  };

  return JSON.stringify(
    pkg,
    null,
    2,
  );
}

// Generate manifest.json
function genManifest(app) {
  const manifest = {
    ...BASE_MANIFEST,
    name: app.title,
    appid: app.appId,
    description: `${app.title} - Neo MiniApp`,
    h5: {
      ...BASE_H5,
      title: app.title,
    },
  };

  return JSON.stringify(
    manifest,
    null,
    2,
  );
}

// Generate pages.json
function genPagesJson(app) {
  const pages = {
    pages: [{ path: "pages/index/index", style: { navigationBarTitleText: app.title } }],
    globalStyle: {
      ...BASE_GLOBAL_STYLE,
      navigationBarTitleText: app.title,
      navigationBarBackgroundColor: pickCategoryColor(app.category),
      backgroundColor: pickCategoryColor(app.category),
    },
  };

  return JSON.stringify(
    pages,
    null,
    2,
  );
}

module.exports = { genPackageJson, genManifest, genPagesJson };
