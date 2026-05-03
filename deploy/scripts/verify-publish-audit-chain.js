#!/usr/bin/env node
/* eslint-disable no-console */

const dns = require("dns");
dns.setDefaultResultOrder("ipv4first");

const { Client } = require("pg");
const { createHash } = require("crypto");
try {
  // Optional: supports local .env when dotenv is installed.
  require("dotenv").config();
} catch (e) {
  // dotenv is optional - warn if missing
  if (e instanceof Error && e.message.includes("dotenv")) {
    console.warn("[verify-publish-audit-chain] dotenv not found, continuing without it");
  }
}

function getEnv(key, fallback = "") {
  return String(process.env[key] || fallback).trim();
}

function stableStringify(value) {
  if (value === null || value === undefined) return "null";
  if (typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  const keys = Object.keys(value).sort((a, b) => a.localeCompare(b));
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function parseArgs(argv) {
  const out = {
    appId: "",
    requestId: "",
    limit: 1000,
  };

  for (const arg of argv) {
    if (arg.startsWith("--app-id=")) out.appId = arg.slice("--app-id=".length);
    else if (arg.startsWith("--request-id=")) out.requestId = arg.slice("--request-id=".length);
    else if (arg.startsWith("--limit=")) {
      const parsed = Number.parseInt(arg.slice("--limit=".length), 10);
      if (Number.isFinite(parsed) && parsed > 0) out.limit = parsed;
    }
  }

  return out;
}

function buildPgConfig() {
  const databaseUrl = getEnv("DATABASE_URL");
  if (databaseUrl) {
    return {
      connectionString: databaseUrl,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 10000,
    };
  }

  const host = getEnv("POSTGRES_HOST");
  const password = getEnv("POSTGRES_PASSWORD");
  if (!host || !password) {
    return null;
  }

  return {
    host,
    port: Number.parseInt(getEnv("POSTGRES_PORT", "5432"), 10),
    database: getEnv("POSTGRES_DB", "postgres"),
    user: getEnv("POSTGRES_USER", "postgres"),
    password,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  };
}

function buildSupabaseRestConfig() {
  const url = getEnv("SUPABASE_URL") || getEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceKey = getEnv("SUPABASE_SERVICE_ROLE_KEY") || getEnv("SUPABASE_SERVICE_KEY");
  if (!url || !serviceKey) return null;
  return {
    url: url.replace(/\/+$/, ""),
    serviceKey,
  };
}

function computeExpectedChainHash(row, prevHash) {
  const payload = row.payload && typeof row.payload === "object" ? row.payload : {};
  const base = stableStringify({
    request_id: row.request_id,
    app_id: row.app_id,
    actor: row.actor,
    action: row.action,
    status: row.status,
    payload,
    prev_hash: prevHash,
  });
  return sha256(base);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  try {
    const { rows, source } = await loadAuditRows(args);
    let total = 0;
    let invalid = 0;
    let chainBreaks = 0;

    const byRequest = new Map();
    for (const row of rows) {
      const key = String(row.request_id);
      if (!byRequest.has(key)) byRequest.set(key, []);
      byRequest.get(key).push(row);
    }

    const issues = [];

    for (const [requestId, events] of byRequest.entries()) {
      let previousHash = null;
      for (const event of events) {
        total += 1;

        const prevHash = event.prev_hash || null;
        if (prevHash !== previousHash) {
          chainBreaks += 1;
          issues.push({
            request_id: requestId,
            id: event.id,
            type: "prev_hash_mismatch",
            expected_prev_hash: previousHash,
            actual_prev_hash: prevHash,
          });
        }

        const expectedHash = computeExpectedChainHash(event, prevHash);
        if (expectedHash !== event.chain_hash) {
          invalid += 1;
          issues.push({
            request_id: requestId,
            id: event.id,
            type: "chain_hash_mismatch",
            expected_chain_hash: expectedHash,
            actual_chain_hash: event.chain_hash,
          });
        }

        previousHash = event.chain_hash;
      }
    }

    const summary = {
      source,
      scanned: rows.length,
      requests: byRequest.size,
      total_events: total,
      invalid_hash_events: invalid,
      chain_break_events: chainBreaks,
      ok: invalid === 0 && chainBreaks === 0,
      issues: issues.slice(0, 50),
    };

    console.log(JSON.stringify(summary, null, 2));

    if (!summary.ok) {
      process.exitCode = 2;
    }
  } catch (error) {
    console.error("verify-publish-audit-chain failed:", error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

async function loadAuditRows(args) {
  const pgConfig = buildPgConfig();
  if (pgConfig) {
    const client = new Client(pgConfig);
    await client.connect();
    try {
      const rows = await loadAuditRowsFromPostgres(client, args);
      return { rows, source: "postgres" };
    } finally {
      await client.end();
    }
  }

  const restConfig = buildSupabaseRestConfig();
  if (restConfig) {
    const rows = await loadAuditRowsFromSupabaseRest(restConfig, args);
    return { rows, source: "supabase-rest" };
  }

  throw new Error(
    "DATABASE_URL or POSTGRES_HOST/POSTGRES_PASSWORD is required for direct Postgres verification; alternatively set SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL with SUPABASE_SERVICE_ROLE_KEY/SUPABASE_SERVICE_KEY for Supabase REST verification",
  );
}

async function loadAuditRowsFromPostgres(client, args) {
  const where = [];
  const params = [];

  if (args.appId) {
    params.push(args.appId);
    where.push(`app_id = $${params.length}`);
  }
  if (args.requestId) {
    params.push(args.requestId);
    where.push(`request_id = $${params.length}`);
  }

  const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";

  params.push(args.limit);
  const sql = `
    SELECT
      id,
      request_id,
      app_id,
      actor,
      action,
      status,
      payload,
      prev_hash,
      chain_hash,
      created_at
    FROM miniapp_publish_request_audit
    ${whereClause}
    ORDER BY request_id ASC, created_at ASC, id ASC
    LIMIT $${params.length}
  `;

  const { rows } = await client.query(sql, params);
  return rows;
}

async function loadAuditRowsFromSupabaseRest(config, args) {
  const params = new URLSearchParams({
    select: "id,request_id,app_id,actor,action,status,payload,prev_hash,chain_hash,created_at",
    order: "request_id.asc,created_at.asc,id.asc",
    limit: String(args.limit),
  });

  if (args.appId) params.set("app_id", `eq.${args.appId}`);
  if (args.requestId) params.set("request_id", `eq.${args.requestId}`);

  const response = await fetch(`${config.url}/rest/v1/miniapp_publish_request_audit?${params.toString()}`, {
    headers: {
      apikey: config.serviceKey,
      authorization: `Bearer ${config.serviceKey}`,
      accept: "application/json",
    },
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Supabase REST verification failed: ${response.status} ${body.slice(0, 300)}`);
  }

  const rows = await response.json();
  if (!Array.isArray(rows)) {
    throw new Error("Supabase REST verification returned a non-array response");
  }
  return rows;
}

main();
