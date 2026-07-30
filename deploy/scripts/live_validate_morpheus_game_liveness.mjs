#!/usr/bin/env node

/**
 * Read-only liveness validation for the Morpheus-backed game miniapps.
 *
 * This is intentionally not a full primary gameplay harness: it does not spend
 * GAS or simulate a winning run. It verifies the wiring that must be correct
 * before those game flows can work:
 *   - every game manifest resolves to a deployed testnet contract;
 *   - oracle-kernel games point at the configured Morpheus oracle contract;
 *   - direct-TEE-settlement games have the Morpheus verifier teeSigner set;
 *   - the public Morpheus runtime health endpoints are reachable.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..", "..");
const rpcUrl =
  process.env.NEO_TESTNET_RPC_URL ||
  process.env.NEO_RPC_URL ||
  "https://api.n3index.dev/testnet";

const oracleKernelGames = new Map([
  ["aim-master", "MiniAppAimMaster"],
  ["color-clash", "MiniAppColorClash"],
  ["flappy-dash", "MiniAppFlappyDash"],
  ["game-2048", "MiniAppGame2048"],
  ["curve-arrow", "MiniAppCurveArrow"],
  ["merge-kingdom", "MiniAppMergeKingdom"],
  ["pet-potion", "MiniAppPetPotion"],
  ["snake-bounty", "MiniAppSnakeBounty"],
  ["sudoku", "MiniAppSudoku"],
]);

const directTeeGames = new Map([
  ["jump-rush", "MiniAppJumpRush"],
  ["sheep-solitaire", "MiniAppSheepSolitaire"],
]);

const allGames = new Map([...oracleKernelGames, ...directTeeGames]);
const selectedSlugs = new Set(process.argv.slice(2).filter(Boolean));
const targetGames =
  selectedSlugs.size > 0
    ? new Map([...allGames].filter(([slug]) => selectedSlugs.has(slug)))
    : allGames;
const unknownSlugs = [...selectedSlugs].filter((slug) => !allGames.has(slug));

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function normalizeHash160(value) {
  const raw = String(value || "").trim().toLowerCase();
  const prefixed = raw && !raw.startsWith("0x") ? `0x${raw}` : raw;
  if (!/^0x[0-9a-f]{40}$/.test(prefixed)) return "";
  if (prefixed === "0x0000000000000000000000000000000000000000") return "";
  return prefixed;
}

function appManifest(slug) {
  return readJson(path.join(repoRoot, "apps", slug, "neo-manifest.json"));
}

function manifestHash(slug) {
  const manifest = appManifest(slug);
  return normalizeHash160(manifest?.contracts?.["neo-n3-testnet"]);
}

function isPublishedGuestOnly(slug) {
  const manifest = appManifest(slug);
  const permissions = Array.isArray(manifest?.permissions) ? manifest.permissions : [];
  const operations = Array.isArray(manifest?.operation_panel?.operations)
    ? manifest.operation_panel.operations
    : [];
  return manifest?.platform?.transactions === false
    && permissions.length === 0
    && operations.length === 0;
}

function generatedRegistryText() {
  return fs.readFileSync(
    path.join(repoRoot, "apps", "shared", "constants", "generated-morpheus-registry.ts"),
    "utf8",
  );
}

function resolveExpectedOracleHash() {
  const fromEnv = normalizeHash160(
    process.env.MORPHEUS_ORACLE_TESTNET_HASH ||
      process.env.CONTRACT_MORPHEUS_ORACLE_TESTNET ||
      process.env.CONTRACT_MORPHEUS_ORACLE_TESTNET_HASH,
  );
  if (fromEnv) return fromEnv;
  const match = generatedRegistryText().match(
    /"testnet":\s*\{[\s\S]*?"contracts":\s*\{[\s\S]*?"morpheusOracle":\s*"([^"]+)"/,
  );
  return normalizeHash160(match?.[1]);
}

function resolveExpectedTeeSigner() {
  const fromEnv = String(
    process.env.MINIAPP_TEE_SIGNER_PUBLIC_KEY_TESTNET ||
      process.env.MORPHEUS_ORACLE_VERIFIER_PUBLIC_KEY_TESTNET ||
      process.env.MINIAPP_TEE_SIGNER_PUBLIC_KEY ||
      process.env.MORPHEUS_ORACLE_VERIFIER_PUBLIC_KEY ||
      "",
  ).trim().toLowerCase();
  if (/^(02|03)[0-9a-f]{64}$/.test(fromEnv)) return fromEnv;

  const candidates = [
    path.join(repoRoot, "..", "neo-os-services", "config", "signer-identities.json"),
    path.join(repoRoot, "..", "..", "neo-os-services", "config", "signer-identities.json"),
    path.join(process.env.HOME || "", "git", "r3e", "neo-os-services", "config", "signer-identities.json"),
  ];
  for (const candidate of candidates) {
    if (!candidate || !fs.existsSync(candidate)) continue;
    const config = readJson(candidate);
    const key = String(
      config?.neo_n3?.testnet?.roles?.oracle_verifier?.public_key || "",
    ).trim().toLowerCase();
    if (/^(02|03)[0-9a-f]{64}$/.test(key)) return key;
  }
  return "";
}

async function fetchJson(url, init = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const text = await response.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = { raw: text };
    }
    return { response, json };
  } finally {
    clearTimeout(timeoutId);
  }
}

async function rpc(method, params) {
  const { response, json } = await fetchJson(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  if (!response.ok) throw new Error(`RPC ${method} HTTP ${response.status}`);
  if (json?.error) throw new Error(`RPC ${method}: ${JSON.stringify(json.error)}`);
  return json?.result;
}

function stackHash160(item) {
  if (!item) return "";
  if (item.type === "Hash160") return normalizeHash160(item.value);
  if ((item.type === "ByteString" || item.type === "ByteArray") && item.value) {
    const bytes = Buffer.from(String(item.value), "base64");
    if (bytes.length === 20) {
      return `0x${Buffer.from(bytes).reverse().toString("hex")}`;
    }
  }
  return "";
}

function stackPublicKey(item) {
  if (!item) return "";
  if (item.type === "PublicKey") {
    const key = String(item.value || "").trim().toLowerCase();
    return /^(02|03)[0-9a-f]{64}$/.test(key) ? key : "";
  }
  if ((item.type === "ByteString" || item.type === "ByteArray") && item.value) {
    const key = Buffer.from(String(item.value), "base64").toString("hex").toLowerCase();
    return /^(02|03)[0-9a-f]{64}$/.test(key) ? key : "";
  }
  return "";
}

export function evaluateRuntimeHealth(url, response, json) {
  const expectedNetwork = new URL(url).pathname.split("/").filter(Boolean)[0] || "";
  const actualNetwork = String(json?.network || "").trim().toLowerCase();
  const ready = response.ok
    && json?.ready !== false
    && json?.status !== "error"
    && actualNetwork === expectedNetwork;
  return {
    url,
    status: response.status,
    ready,
    expectedNetwork,
    actualNetwork,
  };
}

async function checkRuntimeHealth() {
  const urls = [
    "https://oracle.meshmini.app/testnet/health",
    "https://edge.meshmini.app/testnet/health",
  ];
  const results = [];
  for (const url of urls) {
    const { response, json } = await fetchJson(url, {
      headers: { accept: "application/json" },
    });
    results.push(evaluateRuntimeHealth(url, response, json));
  }
  return results;
}

async function main() {
  if (unknownSlugs.length > 0) {
    throw new Error(`unknown target slug(s): ${unknownSlugs.join(", ")}`);
  }
  if (targetGames.size === 0) {
    throw new Error(`unknown target slug(s): ${[...selectedSlugs].join(", ")}`);
  }
  const needsOracle = [...targetGames.keys()].some((slug) => oracleKernelGames.has(slug));
  const needsTeeSigner = [...targetGames.keys()].some((slug) => directTeeGames.has(slug));
  const expectedOracle = needsOracle ? resolveExpectedOracleHash() : "";
  const expectedTeeSigner = needsTeeSigner ? resolveExpectedTeeSigner() : "";
  if (needsOracle && !expectedOracle) throw new Error("expected testnet Morpheus oracle hash is unavailable");
  if (needsTeeSigner && !expectedTeeSigner) {
    throw new Error("expected testnet Morpheus tee signer public key is unavailable");
  }

  console.log(`[morpheus-game-liveness] rpc=${rpcUrl}`);
  const health = await checkRuntimeHealth();
  for (const row of health) {
    console.log(
      `[health] ${row.url} status=${row.status} ready=${row.ready} network=${row.actualNetwork || "(missing)"} expected=${row.expectedNetwork}`,
    );
  }
  if (!health.every((row) => row.ready)) {
    throw new Error("one or more public Morpheus runtime health endpoints are not ready for the requested network");
  }

  const failures = [];
  for (const [slug, expectedName] of targetGames) {
    const hash = manifestHash(slug);
    if (!hash) {
      if (isPublishedGuestOnly(slug)) {
        console.log(`[skip] ${slug} is published guest-only with no deployed contract`);
        continue;
      }
      failures.push(`${slug}: missing neo-n3-testnet contract hash`);
      continue;
    }
    const state = await rpc("getcontractstate", [hash]);
    const actualName = String(state?.manifest?.name || "");
    if (actualName !== expectedName) {
      failures.push(`${slug}: contract name ${actualName || "(missing)"} != ${expectedName}`);
      continue;
    }

    if (oracleKernelGames.has(slug)) {
      const result = await rpc("invokefunction", [hash, "oracle", []]);
      const actualOracle = stackHash160(result?.stack?.[0]);
      if (actualOracle !== expectedOracle) {
        failures.push(`${slug}: oracle ${actualOracle || "(unset)"} != ${expectedOracle}`);
        continue;
      }
      console.log(`[ok] ${slug} ${hash} oracle=${actualOracle}`);
    } else {
      const result = await rpc("invokefunction", [hash, "teeSigner", []]);
      const actualSigner = stackPublicKey(result?.stack?.[0]);
      if (actualSigner !== expectedTeeSigner) {
        failures.push(`${slug}: teeSigner ${actualSigner || "(unset)"} != ${expectedTeeSigner}`);
        continue;
      }
      console.log(`[ok] ${slug} ${hash} teeSigner=${actualSigner}`);
    }
  }

  if (failures.length > 0) {
    for (const failure of failures) console.error(`[fail] ${failure}`);
    throw new Error(`${failures.length} Morpheus game liveness check(s) failed`);
  }
  console.log("RESULT: PASS - Morpheus game contracts, oracle/TEE config, and runtime health are reachable.");
}

if (path.resolve(process.argv[1] || "") === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
