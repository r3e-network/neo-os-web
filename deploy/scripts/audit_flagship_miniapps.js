#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..", "..");

const FLAGSHIP_APPS = [
  { brand: "LastSurvivor", slug: "last-survivor", contractDir: "MiniAppLastSurvivor", expectedMethods: ["buyKeys", "getGameStatus"] },
  { brand: "GASBOX", slug: "gasbox", contractDir: "MiniAppGASBox", expectedMethods: ["getMachine", "initiatePlay", "settlePlay"] },
  { brand: "Red Envelope", slug: "red-envelope", contractDir: "MiniAppRedEnvelope", expectedMethods: ["createEnvelope", "claim", "getEnvelope"] },
  { brand: "Daily Check-in", slug: "daily-checkin", contractDir: "MiniAppDailyCheckin", expectedMethods: ["checkIn", "claimRewards", "getCheckinStatus"] },
  { brand: "FogPlay", slug: "fogplay", contractDir: "MiniAppFogPlay", expectedMethods: ["placeBet", "getBet", "getPlayerDailyBet", "getPlayerBetCount"] },
  { brand: "SelfLoan", slug: "self-loan", contractDir: "MiniAppSelfLoan", expectedMethods: ["createLoan", "repayDebt", "getLoanDetails"] },
  { brand: "NeoPay", slug: "neo-pay", contractDir: "MiniAppNeoPay", expectedMethods: ["createStream", "claimStream", "cancelStream", "getStreamDetails", "getUserStreams", "getBeneficiaryStreams"] },
];

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function exists(rel) {
  return fs.existsSync(path.join(root, rel));
}

function safeRead(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function readContractAppId(contractDir) {
  if (!contractDir) return "";
  const sourcePath = path.join(root, "contracts", contractDir, `${contractDir}.cs`);
  if (!fs.existsSync(sourcePath)) return "";
  const source = fs.readFileSync(sourcePath, "utf8");
  const match = source.match(/APP_ID\s*=\s*"([^"]+)"/);
  return match ? match[1] : "";
}

function readManifestMethods(contractDir) {
  if (!contractDir) return [];
  const manifestPath = path.join(root, "contracts", "build", `${contractDir}.manifest.json`);
  if (!fs.existsSync(manifestPath)) return [];
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  return Array.isArray(manifest?.abi?.methods) ? manifest.abi.methods.map((m) => String(m.name || "")) : [];
}

const builtinsSource = safeRead("platform/host-app/lib/miniapp-builtins.ts");
const showcaseSource = safeRead("platform/host-app/lib/miniapp-showcase.ts");
const homeSource = safeRead("platform/host-app/pages/index.tsx");

let hasFailures = false;
const rows = [];

for (const app of FLAGSHIP_APPS) {
  const manifestPath = `apps/${app.slug}/neo-manifest.json`;
  const definitionPath = `platform/host-app/public/miniapp-definitions/${app.slug}.json`;
  const appIndexPath = `apps/${app.slug}/index.html`;
  const appPagePath = `apps/${app.slug}/src/pages/index/index.vue`;
  const contractPath = app.contractDir ? `contracts/${app.contractDir}/${app.contractDir}.csproj` : null;

  const manifest = readJson(path.join(root, manifestPath));
  const definition = exists(definitionPath) ? readJson(path.join(root, definitionPath)) : null;

  const activeNetwork = manifest.default_network || "neo-n3-testnet";
  const contractActive = manifest.contracts?.[activeNetwork] || "";
  const registryLinked = builtinsSource.includes(manifest.id);
  const homeLinked =
    builtinsSource.includes(manifest.id) ||
    showcaseSource.includes(manifest.id) ||
    homeSource.includes(manifest.id);
  const contractExists = contractPath ? exists(contractPath) : false;
  const contractAppId = readContractAppId(app.contractDir);
  const abiMethods = readManifestMethods(app.contractDir);
  const appIndexExists = exists(appIndexPath);
  const appPageExists = exists(appPagePath);
  const definitionExists = Boolean(definition);
  const definitionIdMatches = definitionExists && definition.app_id === manifest.id;
  const definitionHashMatches =
    definitionExists &&
    (!contractActive || !definition.contract?.contract_hash || definition.contract.contract_hash === contractActive);

  const problems = [];
  if (!definitionExists) problems.push("missing host definition");
  if (definitionExists && !definitionIdMatches) problems.push("definition app_id mismatch");
  if (definitionExists && !definitionHashMatches) problems.push("definition contract hash mismatch");
  if (!registryLinked) problems.push("host registry missing app_id");
  if (!homeLinked) problems.push("home catalog missing app_id");
  if (!appIndexExists) problems.push("frontend index missing");
  if (!appPageExists) problems.push("frontend page entry missing");
  if (app.contractDir && !contractExists) problems.push("contract project missing");
  if (app.contractDir && contractAppId && contractAppId !== manifest.id) problems.push("contract APP_ID mismatch");
  if (app.contractDir && abiMethods.length === 0) problems.push("contract manifest missing");
  const missingMethods = (app.expectedMethods || []).filter((name) => !abiMethods.includes(name));
  if (missingMethods.length) problems.push(`missing ABI methods: ${missingMethods.join(",")}`);
  if (!app.contractDir) problems.push("no mapped smart contract");

  if (problems.length) hasFailures = true;

  rows.push({
    brand: app.brand,
    manifestId: manifest.id,
    definitionStatus: definition?.status || "missing",
    activeNetwork,
    contractAddress: contractActive || "missing",
    contractDir: app.contractDir || "missing",
    contractAppId: contractAppId || "missing",
    checkedAbiMethods: app.expectedMethods || [],
    problems,
  });
}

console.log(JSON.stringify(rows, null, 2));

if (hasFailures) {
  process.exitCode = 1;
}
