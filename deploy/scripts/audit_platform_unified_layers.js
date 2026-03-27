#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..", "..");
const APPS_DIR = path.join(ROOT, "apps");

const ROOT_FACTORY_ALLOWLIST = [
  "createMiniApp(",
  "createConsolePage(",
  "createFlamingoLauncherPage(",
  "useFlamingoLauncherPage(",
  "<FlamingoLauncherPage",
];

const APP_ALLOWLIST_FOR_DIRECT_WALLET = new Set([
  "aa-account-lab",
  "aa-market-hub",
  "aa-permissions-lab",
  "aa-relay-console",
  "aa-session-key-lab",
  "neo-multisig",
  "neo-ns",
  "neo-pay",
  "neo-swap",
  "oracle-compute-lab",
  "oracle-http-console",
  "oracle-neodid-console",
  "oracle-price-console",
  "oracle-seal-console",
  "oracle-vrf-console",
  "recovery-guardian",
  "soulbound-certificate",
  "event-ticket-pass",
  "neodid-passport",
]);

const findings = [];
const CHAIN_METHOD_MARKERS = [
  "invokeContract(",
  "invokeRead(",
  "invokeMultiple(",
  "getBalance(",
  "signMessage(",
  "switchToAppChain(",
];
const SHARED_CHAIN_LAYER_MARKERS = [
  "useContractInteraction(",
  "useAbstractAccount(",
  "useOracle(",
  "useGasSponsor(",
];
const WALLET_BALANCE_MARKERS = [
  "getBalance(",
  ".balances",
];

function readText(file) {
  return fs.readFileSync(file, "utf8");
}

function addFinding(kind, severity, file, message) {
  findings.push({
    kind,
    severity,
    file: path.relative(ROOT, file),
    message,
  });
}

function listApps() {
  return fs.readdirSync(APPS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name !== "shared")
    .map((entry) => entry.name)
    .sort();
}

function scanRootFactory(appName) {
  const file = path.join(APPS_DIR, appName, "src", "pages", "index", "index.vue");
  if (!fs.existsSync(file)) return;
  const text = readText(file);
  const usesFactory = ROOT_FACTORY_ALLOWLIST.some((marker) => text.includes(marker));
  if (!usesFactory) {
    addFinding(
      "frontend-shell",
      "warn",
      file,
      "root page does not use a shared miniapp factory helper",
    );
  }
}

function scanMessages(appName) {
  const file = path.join(APPS_DIR, appName, "src", "locale", "messages.ts");
  if (!fs.existsSync(file)) return;
  const text = readText(file);
  if (!text.includes("mergeMessages(")) {
    addFinding(
      "messages",
      "warn",
      file,
      "locale file does not merge shared base messages",
    );
  }
}

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, files);
    } else if (/\.(ts|tsx|vue|js)$/.test(entry.name)) {
      files.push(full);
    }
  }
  return files;
}

function scanUnifiedLayers(appName) {
  const srcDir = path.join(APPS_DIR, appName, "src");
  if (!fs.existsSync(srcDir)) return;
  const files = walk(srcDir);

  for (const file of files) {
    const text = readText(file);

    const usesWallet = text.includes("useWallet() as WalletSDK");
    const usesDirectChainMethods = CHAIN_METHOD_MARKERS.some((marker) => text.includes(marker));
    const usesSharedChainLayer = SHARED_CHAIN_LAYER_MARKERS.some((marker) => text.includes(marker));

    if (
      usesWallet &&
      usesDirectChainMethods &&
      !usesSharedChainLayer &&
      !APP_ALLOWLIST_FOR_DIRECT_WALLET.has(appName)
    ) {
      addFinding(
        "chain-layer",
        "warn",
        file,
        "direct WalletSDK chain method usage without shared contract interaction / AA / Oracle wrapper",
      );
    }

    if (/oracle\.meshmini\.app|control\.meshmini\.app|edge\.meshmini\.app/.test(text)) {
      addFinding(
        "oracle-layer",
        "warn",
        file,
        "hardcoded Morpheus domain found instead of shared integration constants/composables",
      );
    }

    if (/uni\.getStorageSync|uni\.setStorageSync|localStorage\.getItem|localStorage\.setItem/.test(text)) {
      addFinding(
        "cache-layer",
        "info",
        file,
        "custom local cache/storage logic found; check whether it should move to a shared cache utility",
      );
    }

    const usesWalletBalanceMethods = WALLET_BALANCE_MARKERS.some((marker) => text.includes(marker));
    const destructuresWalletBalances = /\{\s*[^}]*\bbalances\b[^}]*\}\s*=\s*useWallet\(\)\s+as WalletSDK/.test(text);

    if ((usesWalletBalanceMethods || destructuresWalletBalances) && text.includes("useWallet() as WalletSDK")) {
      addFinding(
        "balance-layer",
        "info",
        file,
        "direct wallet balance handling found; check whether it should be normalized through a shared balance abstraction",
      );
    }
  }
}

for (const appName of listApps()) {
  scanRootFactory(appName);
  scanMessages(appName);
  scanUnifiedLayers(appName);
}

const bySeverity = { error: 0, warn: 0, info: 0 };
for (const finding of findings) {
  bySeverity[finding.severity] += 1;
}

if (findings.length === 0) {
  console.log("unified-layer audit: no findings");
  process.exit(0);
}

console.log("unified-layer audit summary");
console.log(JSON.stringify(bySeverity, null, 2));
for (const finding of findings) {
  console.log(`[${finding.severity}] ${finding.kind} ${finding.file}: ${finding.message}`);
}

if (process.argv.includes("--strict")) {
  const blocking = findings.some((finding) => finding.severity === "error" || finding.severity === "warn");
  process.exit(blocking ? 1 : 0);
}
