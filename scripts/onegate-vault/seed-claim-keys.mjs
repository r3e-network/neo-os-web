#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const DEFAULT_APP_ID = "miniapp-gas-lucky-pool";
const DEFAULT_NETWORK = "mainnet";
const DEFAULT_POOL_ID = "pool-001";
const DEFAULT_MIN_FIXED8 = 100000000n;
const DEFAULT_MAX_FIXED8 = 5000000000n;

function parseArgs(argv) {
  const args = {
    csv: "",
    network: DEFAULT_NETWORK,
    appId: DEFAULT_APP_ID,
    poolId: DEFAULT_POOL_ID,
    oneGateAppId: "",
    minFixed8: DEFAULT_MIN_FIXED8,
    maxFixed8: DEFAULT_MAX_FIXED8,
    execute: false,
    writeNormalizedCsv: "",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = () => {
      index += 1;
      return argv[index] || "";
    };

    if (arg === "--csv") args.csv = next();
    else if (arg === "--network") args.network = next();
    else if (arg === "--app-id") args.appId = next();
    else if (arg === "--pool-id") args.poolId = next();
    else if (arg === "--onegate-app-id") args.oneGateAppId = next();
    else if (arg === "--min-fixed8") args.minFixed8 = BigInt(next());
    else if (arg === "--max-fixed8") args.maxFixed8 = BigInt(next());
    else if (arg === "--write-normalized-csv") args.writeNormalizedCsv = next();
    else if (arg === "--execute") args.execute = true;
    else if (arg === "--help") printHelpAndExit();
    else throw new Error(`Unknown argument: ${arg}`);
  }

  return args;
}

function printHelpAndExit() {
  console.log(`Usage:
  node scripts/onegate-vault/seed-claim-keys.mjs --csv <file> --onegate-app-id <id> [--execute]

Required env:
  SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SERVICE_KEY
  ONEGATE_VAULT_KEY_PEPPER

Options:
  --network mainnet|testnet
  --app-id miniapp-gas-lucky-pool
  --pool-id pool-001
  --min-fixed8 100000000
  --max-fixed8 5000000000
  --write-normalized-csv <file>
  --execute
`);
  process.exit(0);
}

function assertSafeId(value, label) {
  if (!/^[A-Za-z0-9_.:-]{1,128}$/.test(value)) {
    throw new Error(`${label} is invalid`);
  }
}

function parseCsvLine(line) {
  const cells = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (quoted && char === '"' && next === '"') {
      value += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (!quoted && char === ",") {
      cells.push(value);
      value = "";
    } else {
      value += char;
    }
  }
  cells.push(value);
  return cells;
}

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]).map((header) => header.trim());
  return lines.slice(1).map((line) => {
    const cells = parseCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, cells[index] || ""]));
  });
}

function csvEscape(value) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function toCsv(rows) {
  const headers = [
    "index",
    "pool",
    "claim_key_id",
    "onegate_app_id",
    "app_id",
    "network",
    "key",
    "onegate_link",
  ];
  return [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(",")),
  ].join(os.EOL);
}

function normalizeLink(link, identity) {
  const url = link
    ? new URL(link)
    : new URL(`https://onegate.space/app/${encodeURIComponent(identity.oneGateAppId)}`);
  url.protocol = "https:";
  url.hostname = "onegate.space";
  url.pathname = `/app/${encodeURIComponent(identity.oneGateAppId)}`;
  url.searchParams.set("source", url.searchParams.get("source") || "onegate");
  url.searchParams.set("appId", identity.appId);
  url.searchParams.set(
    "operation",
    url.searchParams.get("operation") || "claimOneGateVault",
  );
  url.searchParams.set("network", identity.network);
  url.searchParams.set("pool", identity.poolId);
  url.searchParams.set("oneGateId", identity.oneGateAppId);
  url.searchParams.set("oneGateAppId", identity.oneGateAppId);
  url.searchParams.set("key", identity.claimKey);
  return url.toString();
}

function extractOneGateAppId(row, fallback) {
  if (fallback) return fallback;
  const link = row.onegate_link || row.link || "";
  if (!link) return "";
  const url = new URL(link);
  const queryId =
    url.searchParams.get("oneGateId") ||
    url.searchParams.get("oneGateAppId") ||
    url.searchParams.get("onegateAppId") ||
    "";
  if (queryId) return queryId;
  const match = url.pathname.match(/\/app\/([^/?#]+)/);
  return match ? decodeURIComponent(match[1]) : "";
}

function claimKeyIdFromKey(key, fallbackIndex) {
  const match = key.match(/^(ogv_[A-Za-z0-9]+)/);
  return match ? match[1] : `ogv_${String(fallbackIndex).padStart(3, "0")}`;
}

function hashClaimKey(key, pepper) {
  return crypto.createHash("sha256").update(`${pepper}:${key}`, "utf8").digest("hex");
}

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!match || process.env[match[1]]) continue;
    process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
  }
}

async function upsertInChunks(table, rows, supabase) {
  const chunkSize = 200;
  for (let index = 0; index < rows.length; index += chunkSize) {
    const chunk = rows.slice(index, index + chunkSize);
    const { error } = await supabase.from(table).insert(chunk);
    if (error) throw error;
  }
}

async function main() {
  readEnvFile(path.resolve(process.cwd(), ".env"));
  readEnvFile(path.resolve(process.cwd(), "platform/host-app/.env"));

  const args = parseArgs(process.argv.slice(2));
  if (!args.csv) throw new Error("--csv is required");
  if (!["mainnet", "testnet"].includes(args.network)) {
    throw new Error("--network must be mainnet or testnet");
  }
  assertSafeId(args.appId, "app id");
  assertSafeId(args.poolId, "pool id");
  if (args.oneGateAppId) assertSafeId(args.oneGateAppId, "OneGate app id");
  if (args.minFixed8 < DEFAULT_MIN_FIXED8 || args.maxFixed8 > DEFAULT_MAX_FIXED8 || args.minFixed8 > args.maxFixed8) {
    throw new Error("reward range must stay within 1-50 GAS");
  }

  const pepper = process.env.ONEGATE_VAULT_KEY_PEPPER;
  if (args.execute) {
    if (!(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL)) {
      throw new Error("SUPABASE_URL is required");
    }
    if (!(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY)) {
      throw new Error("SUPABASE_SERVICE_ROLE_KEY is required");
    }
    if (!pepper) throw new Error("ONEGATE_VAULT_KEY_PEPPER is required");
  }

  const rows = parseCsv(fs.readFileSync(args.csv, "utf8"));
  if (!rows.length) throw new Error("CSV does not contain claim keys");

  const normalized = rows.map((row, index) => {
    const claimKey = String(row.key || row.claimKey || row.claim_key || "").trim();
    const poolId = args.poolId.trim();
    const oneGateAppId = extractOneGateAppId(row, args.oneGateAppId).trim();
    if (!claimKey) throw new Error(`row ${index + 1}: key is required`);
    if (!poolId) throw new Error(`row ${index + 1}: pool is required`);
    if (!oneGateAppId) throw new Error(`row ${index + 1}: onegate app id is required`);
    assertSafeId(poolId, `row ${index + 1} pool`);
    assertSafeId(oneGateAppId, `row ${index + 1} OneGate app id`);
    return {
      index: String(row.index || index + 1),
      pool: poolId,
      claim_key_id: String(row.claim_key_id || row.claimKeyId || claimKeyIdFromKey(claimKey, index + 1)).trim(),
      onegate_app_id: oneGateAppId,
      app_id: args.appId,
      network: args.network,
      key: claimKey,
      key_hash: pepper ? hashClaimKey(claimKey, pepper) : "",
      onegate_link: normalizeLink(row.onegate_link || row.link || "", {
        appId: args.appId,
        network: args.network,
        poolId,
        oneGateAppId,
        claimKey,
      }),
    };
  });

  const duplicateKeys = new Set();
  const seenKeys = new Set();
  for (const row of normalized) {
    const duplicateIdentity = row.key_hash || row.key;
    if (seenKeys.has(duplicateIdentity)) duplicateKeys.add(row.claim_key_id);
    seenKeys.add(duplicateIdentity);
  }
  if (duplicateKeys.size) {
    throw new Error(`duplicate claim keys in CSV: ${duplicateKeys.size}`);
  }

  if (args.writeNormalizedCsv) {
    fs.writeFileSync(args.writeNormalizedCsv, `${toCsv(normalized)}${os.EOL}`);
  }

  const grouped = new Map();
  for (const row of normalized) {
    const group = grouped.get(row.pool) || [];
    group.push(row);
    grouped.set(row.pool, group);
  }

  console.log(
    JSON.stringify(
      {
        mode: args.execute ? "execute" : "dry-run",
        rows: normalized.length,
        pools: grouped.size,
        network: args.network,
        app_id: args.appId,
        onegate_app_ids: [...new Set(normalized.map((row) => row.onegate_app_id))].sort(),
        normalized_csv: args.writeNormalizedCsv || null,
      },
      null,
      2,
    ),
  );

  if (!args.execute) return;

  const supabase = createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY,
    {
      auth: { persistSession: false },
    },
  );
  const pools = [...grouped.keys()];
  const { data: existingCampaigns, error: campaignSelectError } = await supabase
    .from("onegate_vault_campaigns")
    .select("id,network,claimed_count")
    .in("id", pools)
    .eq("network", args.network);
  if (campaignSelectError) throw campaignSelectError;
  const existingCampaignMap = new Map((existingCampaigns || []).map((row) => [row.id, row]));
  const existingCampaignIds = new Set(existingCampaignMap.keys());

  const newCampaigns = [...grouped.entries()]
    .filter(([poolId]) => !existingCampaignIds.has(poolId))
    .map(([poolId, group]) => ({
      id: poolId,
      app_id: args.appId,
      onegate_app_id: group[0].onegate_app_id,
      network: args.network,
      status: "active",
      min_amount_fixed8: String(args.minFixed8),
      max_amount_fixed8: String(args.maxFixed8),
      remaining_amount_fixed8: String(args.maxFixed8 * BigInt(group.length)),
      max_claims: group.length,
      claimed_count: 0,
      metadata: {
        source: "onegate-vault-seed-claim-keys",
        pool_model: "single-pool-many-keys",
        imported_key_count: group.length,
      },
    }));
  if (newCampaigns.length) await upsertInChunks("onegate_vault_campaigns", newCampaigns, supabase);

  for (const [poolId, group] of grouped.entries()) {
    if (!existingCampaignIds.has(poolId)) continue;
    const existingCampaign = existingCampaignMap.get(poolId);
    const campaignPatch = {
      app_id: args.appId,
      onegate_app_id: group[0].onegate_app_id,
      min_amount_fixed8: String(args.minFixed8),
      max_amount_fixed8: String(args.maxFixed8),
      max_claims: group.length,
      metadata: {
        source: "onegate-vault-seed-claim-keys",
        pool_model: "single-pool-many-keys",
        imported_key_count: group.length,
      },
    };
    if (!Number(existingCampaign?.claimed_count || 0)) {
      campaignPatch.remaining_amount_fixed8 = String(args.maxFixed8 * BigInt(group.length));
      campaignPatch.claimed_count = 0;
    }
    const { error } = await supabase
      .from("onegate_vault_campaigns")
      .update(campaignPatch)
      .eq("id", poolId)
      .eq("network", args.network);
    if (error) throw error;
  }

  const { data: existingKeys, error: keySelectError } = await supabase
    .from("onegate_vault_claim_keys")
    .select("key_hash,campaign_id,network,status")
    .in("key_hash", normalized.map((row) => row.key_hash))
    .eq("network", args.network);
  if (keySelectError) throw keySelectError;
  const existingKeyMap = new Map((existingKeys || []).map((row) => [row.key_hash, row]));

  const newKeys = [];
  const reassignedKeys = [];
  for (const row of normalized) {
    const existing = existingKeyMap.get(row.key_hash);
    if (existing && existing.campaign_id !== row.pool) {
      if (existing.status !== "unused") {
        throw new Error(`claim key identity conflict for ${row.claim_key_id}`);
      }
      reassignedKeys.push(row);
      continue;
    }
    if (!existing) {
      newKeys.push({
        key_hash: row.key_hash,
        campaign_id: row.pool,
        claim_key_id: row.claim_key_id,
        onegate_app_id: row.onegate_app_id,
        network: row.network,
      });
    }
  }
  if (newKeys.length) await upsertInChunks("onegate_vault_claim_keys", newKeys, supabase);

  for (const row of normalized) {
    if (!existingKeyMap.has(row.key_hash)) continue;
    const { error } = await supabase
      .from("onegate_vault_claim_keys")
      .update({
        campaign_id: row.pool,
        claim_key_id: row.claim_key_id,
        onegate_app_id: row.onegate_app_id,
      })
      .eq("key_hash", row.key_hash)
      .eq("network", row.network);
    if (error) throw error;
  }

  console.log(
    JSON.stringify(
      {
        inserted_campaigns: newCampaigns.length,
        updated_campaign_identities: grouped.size - newCampaigns.length,
        inserted_claim_keys: newKeys.length,
        updated_claim_key_identities: normalized.length - newKeys.length,
        reassigned_unused_claim_keys: reassignedKeys.length,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
