#!/usr/bin/env node

/**
 * create-miniapp.mjs - Interactive CLI scaffolding for new miniapps.
 *
 * Usage: node scripts/create-miniapp.mjs
 *
 * Prompts for app metadata, then generates all boilerplate files under
 * miniapps/{slug}/ and runs sync-miniapp-registry.mjs to register it.
 */

import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { mkdir, writeFile, access } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

import {
  VALID_CATEGORIES,
  VALID_PERMISSIONS,
} from "./miniapp-manifest-schema.mjs";

// ── Constants ──────────────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolve(__dirname, "..");
const MINIAPPS_DIR = resolve(PROJECT_ROOT, "miniapps");

const TEMPLATE_TYPES = [
  "game-board",
  "form-panel",
  "dashboard",
  "swap-interface",
  "market-list",
  "timer-hero",
  "custom",
];

const CATEGORY_DISPLAY = {
  gaming: { name: "Games", name_zh: "游戏" },
  defi: { name: "DeFi", name_zh: "去中心化金融" },
  social: { name: "Social", name_zh: "社交" },
  nft: { name: "NFT", name_zh: "数字藏品" },
  governance: { name: "Governance", name_zh: "治理" },
  utility: { name: "Utility", name_zh: "工具" },
};

// ── ANSI helpers ───────────────────────────────────────────────────────

const c = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  cyan: "\x1b[36m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  magenta: "\x1b[35m",
};

const log = {
  info: (msg) => console.log(`${c.cyan}[info]${c.reset} ${msg}`),
  ok: (msg) => console.log(`${c.green}[ok]${c.reset}   ${msg}`),
  warn: (msg) => console.log(`${c.yellow}[warn]${c.reset} ${msg}`),
  err: (msg) => console.error(`${c.red}[err]${c.reset}  ${msg}`),
  step: (msg) => console.log(`\n${c.bold}${c.magenta}>> ${msg}${c.reset}`),
};

// ── Validation ─────────────────────────────────────────────────────────

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function validateSlug(slug) {
  if (!slug) return "Slug cannot be empty.";
  if (!SLUG_RE.test(slug))
    return "Slug must be lowercase letters, numbers, and hyphens only (no leading/trailing hyphens).";
  return null;
}

async function dirExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

// ── Prompt helpers ─────────────────────────────────────────────────────

async function ask(rl, question, validator) {
  while (true) {
    const answer = (await rl.question(`${c.cyan}?${c.reset} ${question}: `)).trim();
    if (validator) {
      const err = typeof validator === "function" ? await validator(answer) : null;
      if (err) {
        log.err(err);
        continue;
      }
    }
    return answer;
  }
}

async function askOptional(rl, question) {
  const answer = (await rl.question(
    `${c.cyan}?${c.reset} ${question} ${c.dim}(Enter to skip)${c.reset}: `,
  )).trim();
  return answer || "";
}

async function selectOne(rl, question, options) {
  const list = options
    .map((o, i) => `  ${c.bold}${i + 1}${c.reset}) ${o}`)
    .join("\n");
  const prompt = `${question}\n${list}\n  Choice [1-${options.length}]`;

  const val = await ask(rl, prompt, (v) => {
    const n = parseInt(v, 10);
    if (isNaN(n) || n < 1 || n > options.length)
      return `Enter a number between 1 and ${options.length}.`;
    return null;
  });
  return options[parseInt(val, 10) - 1];
}

async function askMultiSelect(rl, question, options) {
  const list = options
    .map((o, i) => `  ${c.bold}${i + 1}${c.reset}) ${o}`)
    .join("\n");
  const prompt = `${question}\n${list}\n  Comma-separated numbers (e.g. 1,3,5)`;

  const raw = await ask(rl, prompt, (val) => {
    if (!val) return null;
    const parts = val.split(",").map((s) => s.trim());
    for (const p of parts) {
      const n = parseInt(p, 10);
      if (isNaN(n) || n < 1 || n > options.length)
        return `Invalid selection "${p}". Use numbers 1-${options.length}.`;
    }
    return null;
  });

  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => options[parseInt(s.trim(), 10) - 1])
    .filter(Boolean);
}

// ── File generators ────────────────────────────────────────────────────

function genPackageJson(slug) {
  return JSON.stringify(
    {
      name: `miniapp-${slug}`,
      version: "1.0.0",
      private: true,
      scripts: {
        dev: "uni",
        "build:h5": "uni build -p h5",
        build: "uni build -p h5",
      },
      dependencies: {
        vue: "catalog:",
        "@dcloudio/uni-app": "catalog:",
        "@dcloudio/uni-h5": "catalog:",
        "@dcloudio/uni-components": "catalog:",
        "@neo/uniapp-sdk": "workspace:*",
        "@neo/types": "workspace:*",
      },
      devDependencies: {
        "@dcloudio/uni-cli-shared": "catalog:",
        "@dcloudio/vite-plugin-uni": "catalog:",
        typescript: "catalog:",
        vite: "catalog:",
        sass: "catalog:",
      },
    },
    null,
    2,
  );
}

function genViteConfig() {
  return `import { createAppConfig } from "../vite.shared";

export default createAppConfig(__dirname);
`;
}

function genTsConfig() {
  return JSON.stringify(
    {
      extends: "../tsconfig.miniapp.json",
      compilerOptions: {
        paths: {
          "@/*": ["./src/*"],
          "@shared/*": ["../../shared/*"],
        },
        types: ["@dcloudio/types"],
      },
      include: ["src/**/*.ts", "src/**/*.vue"],
      exclude: ["node_modules", "dist"],
    },
    null,
    2,
  );
}

function genIndexHtml(nameEn) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=0, viewport-fit=cover" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
  <title>${nameEn}</title>
  <link rel="icon" type="image/png" href="/logo.jpg" />
  <meta property="og:image" content="/banner.jpg" />
</head>
<body>
  <div id="app"></div>
  <script type="module" src="./src/main.ts"></script>
</body>
</html>
`;
}

function genNeoManifest(opts) {
  const now = new Date().toISOString();
  const contracts = {};
  if (opts.testnetContract)
    contracts["neo-n3-testnet"] = opts.testnetContract;
  if (opts.mainnetContract)
    contracts["neo-n3-mainnet"] = opts.mainnetContract;

  const catDisplay = CATEGORY_DISPLAY[opts.category] || {
    name: opts.category,
    name_zh: opts.category,
  };

  const permissionStrings = (opts.permissions || []).map((p) => {
    if (p === "payments") return "invoke:primary";
    return p;
  });

  return JSON.stringify(
    {
      $schema: "https://schemas.r3e.network/miniapp-manifest/v1.json",
      id: `miniapp-${opts.slug}`,
      name: opts.nameEn,
      name_zh: opts.nameZh,
      version: "1.0.0",
      description: opts.descEn,
      description_zh: opts.descZh,
      category: opts.category,
      category_name: catDisplay.name,
      category_name_zh: catDisplay.name_zh,
      tags: [],
      developer: {
        name: "R3E Network",
        email: "dev@r3e.network",
        website: "https://r3e.network",
      },
      contracts,
      supported_networks: ["neo-n3-mainnet"],
      default_network: "neo-n3-mainnet",
      urls: {
        entry: `/miniapps/${opts.slug}/index.html`,
        icon: `/miniapps/${opts.slug}/logo.jpg`,
        banner: `/miniapps/${opts.slug}/banner.jpg`,
      },
      permissions: permissionStrings,
      features: {
        stateless: true,
        offlineSupport: false,
        deeplink: `neomainapp://${opts.slug}`,
      },
      stateSource: {
        type: "smart-contract",
        chain: "neo-n3-mainnet",
        endpoints: ["https://neo.coz.io/mainnet"],
      },
      platform: {
        analytics: true,
        comments: true,
        ratings: true,
        transactions: true,
      },
      createdAt: now,
      updatedAt: now,
    },
    null,
    2,
  );
}

function genMainTs() {
  return `import { createSSRApp } from "vue";
import App from "./App.vue";

export function createApp() {
    const app = createSSRApp(App);
    return {
        app,
    };
}
`;
}

function genAppVue() {
  return `<script setup lang="ts">
import { onLaunch, onShow, onHide } from "@dcloudio/uni-app";
import { onMounted } from "vue";
import { initTheme, listenForThemeChanges } from "@shared/utils/theme";

onLaunch(() => {});
onShow(() => {});
onHide(() => {});

onMounted(() => {
  initTheme();
  listenForThemeChanges();
});
</script>

<style lang="scss">
page {
  background: linear-gradient(135deg, var(--bg-primary) 0%, var(--bg-secondary) 100%);
  height: 100%;
}
</style>
`;
}

function genSrcManifest(slug, nameEn, descEn) {
  return JSON.stringify(
    {
      name: nameEn,
      appid: `miniapp-${slug}`,
      description: descEn,
      versionName: "1.0.0",
      versionCode: "100",
      transformPx: false,
      h5: {
        title: nameEn,
        router: { mode: "hash" },
        devServer: { port: 5173 },
      },
    },
    null,
    2,
  );
}

function genPagesJson(nameEn) {
  return JSON.stringify(
    {
      pages: [
        {
          path: "pages/index/index",
          style: { navigationBarTitleText: nameEn },
        },
      ],
      globalStyle: {
        navigationBarTextStyle: "white",
        navigationBarTitleText: nameEn,
        navigationBarBackgroundColor: "#0d1117",
        backgroundColor: "#0d1117",
      },
    },
    null,
    2,
  );
}

function genLocaleEn(nameEn, descEn) {
  return JSON.stringify(
    {
      title: nameEn,
      description: descEn,
      connectWallet: "Connect Wallet",
      loading: "Loading...",
      docs: "Documentation",
    },
    null,
    2,
  );
}

function genLocaleZh(nameZh, descZh) {
  return JSON.stringify(
    {
      title: nameZh,
      description: descZh,
      connectWallet: "连接钱包",
      loading: "加载中...",
      docs: "文档",
    },
    null,
    2,
  );
}

function genUseApp() {
  return `import { ref, computed } from "vue";

export function useApp() {
  const loading = ref(false);
  const error = ref<string | null>(null);

  return {
    loading,
    error,
  };
}
`;
}

function genUseI18n() {
  return `import { ref, computed } from "vue";
import en from "../locale/en.json";
import zh from "../locale/zh.json";

const locales: Record<string, Record<string, string>> = { en, zh };

export function useI18n() {
  const locale = ref("en");

  const t = (key: string): string => {
    return locales[locale.value]?.[key] || locales.en?.[key] || key;
  };

  const setLocale = (l: string) => {
    locale.value = l;
  };

  return { t, locale, setLocale };
}
`;
}

function genIndexPage(templateType) {
  return `<template>
  <MiniAppTemplate
    :config="templateConfig"
    :state="appState"
    :t="t"
  >
    <template #content>
      <view class="content-container">
        <NeoCard>
          <text class="title">{{ t('title') }}</text>
          <text class="description">{{ t('description') }}</text>
        </NeoCard>
      </view>
    </template>
  </MiniAppTemplate>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { MiniAppTemplate, NeoCard } from "@shared/components";
import type { MiniAppTemplateConfig } from "@shared/types/template-config";
import { useI18n } from "@/composables/useI18n";

const { t } = useI18n();

const templateConfig: MiniAppTemplateConfig = {
  contentType: "${templateType}",
  tabs: [
    { key: "main", labelKey: "title", icon: "🏠", default: true },
    { key: "docs", labelKey: "docs", icon: "📖" },
  ],
  features: {
    chainWarning: true,
    statusMessages: true,
    docs: {
      titleKey: "title",
      subtitleKey: "description",
      stepKeys: [],
      featureKeys: [],
    },
  },
};

const appState = computed(() => ({}));
</script>

<style lang="scss" scoped>
.content-container {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.title {
  font-size: 24px;
  font-weight: 700;
  color: var(--text-primary);
}

.description {
  font-size: 14px;
  color: var(--text-secondary);
  margin-top: 8px;
}
</style>
`;
}

// ── Main ───────────────────────────────────────────────────────────────

async function main() {
  console.log(
    `\n${c.bold}${c.green}=== Create MiniApp ===${c.reset}\n` +
      `${c.dim}Interactive scaffolding for the Neo MiniApp Platform${c.reset}\n`,
  );

  const rl = createInterface({ input: stdin, output: stdout });

  try {
    // 1. Slug
    log.step("App Identity");
    const slug = await ask(rl, "App slug (e.g. my-cool-app)", async (val) => {
      const err = validateSlug(val);
      if (err) return err;
      if (await dirExists(resolve(MINIAPPS_DIR, val)))
        return `Directory miniapps/${val} already exists.`;
      return null;
    });

    // 2-3. Display names
    const nameEn = await ask(rl, 'Display name EN (e.g. "My Cool App")', (v) =>
      v ? null : "Name cannot be empty.",
    );
    const nameZh = await ask(rl, '显示名称 ZH (e.g. "我的酷应用")', (v) =>
      v ? null : "Name cannot be empty.",
    );

    // 4-5. Descriptions
    log.step("Descriptions");
    const descEn = await ask(rl, "Description EN", (v) =>
      v ? null : "Description cannot be empty.",
    );
    const descZh = await ask(rl, "描述 ZH", (v) =>
      v ? null : "Description cannot be empty.",
    );

    // 6. Category
    log.step("Classification");
    const category = await selectOne(rl, "Category", VALID_CATEGORIES);

    // 7. Permissions
    const permissions = await askMultiSelect(
      rl,
      "Permissions",
      VALID_PERMISSIONS,
    );

    // 8-9. Contract addresses
    log.step("Contracts");
    const testnetContract = await askOptional(
      rl,
      "Testnet contract address (0x...)",
    );
    const mainnetContract = await askOptional(
      rl,
      "Mainnet contract address (0x...)",
    );

    // 10. Template type
    log.step("Template");
    const templateType = await selectOne(rl, "Template type", TEMPLATE_TYPES);

    rl.close();

    // ── Generate files ─────────────────────────────────────────────────

    const opts = {
      slug,
      nameEn,
      nameZh,
      descEn,
      descZh,
      category,
      permissions,
      testnetContract,
      mainnetContract,
      templateType,
    };

    log.step("Generating files");

    const appDir = resolve(MINIAPPS_DIR, slug);
    const srcDir = resolve(appDir, "src");

    const dirs = [
      appDir,
      srcDir,
      resolve(srcDir, "pages/index"),
      resolve(srcDir, "composables"),
      resolve(srcDir, "locale"),
    ];

    for (const d of dirs) {
      await mkdir(d, { recursive: true });
    }

    const files = [
      ["package.json", genPackageJson(slug)],
      ["vite.config.ts", genViteConfig()],
      ["tsconfig.json", genTsConfig()],
      ["index.html", genIndexHtml(nameEn)],
      ["neo-manifest.json", genNeoManifest(opts)],
      ["src/main.ts", genMainTs()],
      ["src/App.vue", genAppVue()],
      ["src/manifest.json", genSrcManifest(slug, nameEn, descEn)],
      ["src/pages.json", genPagesJson(nameEn)],
      ["src/locale/en.json", genLocaleEn(nameEn, descEn)],
      ["src/locale/zh.json", genLocaleZh(nameZh, descZh)],
      ["src/composables/useApp.ts", genUseApp()],
      ["src/composables/useI18n.ts", genUseI18n()],
      ["src/pages/index/index.vue", genIndexPage(templateType)],
    ];

    for (const [relPath, content] of files) {
      const fullPath = resolve(appDir, relPath);
      await writeFile(fullPath, content, "utf-8");
      log.ok(`miniapps/${slug}/${relPath}`);
    }

    // ── Summary ────────────────────────────────────────────────────────

    console.log(
      `\n${c.bold}${c.green}=== Scaffold Complete ===${c.reset}\n` +
        `\n  ${c.bold}App:${c.reset}      ${nameEn} (${nameZh})` +
        `\n  ${c.bold}Slug:${c.reset}     ${slug}` +
        `\n  ${c.bold}Category:${c.reset} ${category}` +
        `\n  ${c.bold}Template:${c.reset} ${templateType}` +
        `\n  ${c.bold}Path:${c.reset}     miniapps/${slug}/` +
        `\n  ${c.bold}Files:${c.reset}    ${files.length} generated\n`,
    );

    // ── Run registry sync (using execFileSync to avoid shell injection) ──

    const syncScript = resolve(PROJECT_ROOT, "scripts/sync-miniapp-registry.mjs");
    if (await dirExists(syncScript)) {
      log.step("Syncing registry");
      try {
        execFileSync(process.execPath, [syncScript], {
          cwd: PROJECT_ROOT,
          stdio: "inherit",
        });
        log.ok("Registry synced.");
      } catch {
        log.warn("Registry sync failed. Run manually: node scripts/sync-miniapp-registry.mjs");
      }
    } else {
      log.warn(
        "sync-miniapp-registry.mjs not found. Run it manually once available.",
      );
    }

    console.log(
      `\n${c.bold}Next steps:${c.reset}` +
        `\n  1. cd miniapps/${slug}` +
        `\n  2. Add logo.jpg and banner.jpg to the directory` +
        `\n  3. pnpm install` +
        `\n  4. pnpm dev\n`,
    );
  } catch (err) {
    if (err?.code === "ERR_USE_AFTER_CLOSE") {
      // readline closed, ignore
    } else {
      log.err(err.message || String(err));
      process.exit(1);
    }
  } finally {
    rl.close();
  }
}

main();
