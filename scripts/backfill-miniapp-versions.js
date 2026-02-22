#!/usr/bin/env node
/* eslint-disable no-console */

const dns = require("dns");
dns.setDefaultResultOrder("ipv4first");

const { Client } = require("pg");
try {
  // Optional: supports local .env when dotenv is installed.
  require("dotenv").config();
} catch {
  // noop
}

function getEnv(key, fallback = "") {
  return String(process.env[key] || fallback).trim();
}

function asActionFromStatus(status) {
  const normalized = String(status || "").trim().toLowerCase();
  if (normalized === "active") return "publish";
  if (normalized === "disabled") return "disable";
  return "save_draft";
}

function asReleaseChannel(action) {
  return action === "publish" ? "published" : "draft";
}

function parseArgs(argv) {
  const out = {
    dryRun: false,
    limit: 0,
    appId: "",
    actor: "backfill_script",
    note: "initial backfill snapshot",
  };

  for (const arg of argv) {
    if (arg === "--dry-run") out.dryRun = true;
    else if (arg.startsWith("--limit=")) out.limit = Number.parseInt(arg.split("=")[1], 10) || 0;
    else if (arg.startsWith("--app-id=")) out.appId = arg.split("=")[1] || "";
    else if (arg.startsWith("--actor=")) out.actor = arg.split("=")[1] || out.actor;
    else if (arg.startsWith("--note=")) out.note = arg.split("=")[1] || out.note;
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

  return {
    host: getEnv("POSTGRES_HOST"),
    port: Number.parseInt(getEnv("POSTGRES_PORT", "5432"), 10),
    database: getEnv("POSTGRES_DB", "postgres"),
    user: getEnv("POSTGRES_USER", "postgres"),
    password: getEnv("POSTGRES_PASSWORD"),
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const client = new Client(buildPgConfig());

  await client.connect();

  try {
    await client.query("BEGIN");

    const where = [];
    const params = [];

    if (args.appId) {
      params.push(args.appId);
      where.push(`m.app_id = $${params.length}`);
    }

    const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const limitClause = args.limit > 0 ? `LIMIT ${args.limit}` : "";

    const query = `
      SELECT
        m.app_id,
        m.status,
        m.manifest_hash,
        m.manifest,
        to_jsonb(m) AS row_snapshot,
        r.draft_version_id,
        r.published_version_id,
        mv.id AS existing_version_id
      FROM miniapps AS m
      LEFT JOIN miniapp_releases AS r
        ON r.app_id = m.app_id
      LEFT JOIN miniapp_versions AS mv
        ON mv.app_id = m.app_id
      ${whereClause}
      GROUP BY m.app_id, m.status, m.manifest_hash, m.manifest, row_snapshot, r.draft_version_id, r.published_version_id, mv.id
      ORDER BY m.app_id ASC
      ${limitClause}
    `;

    const rowsResult = await client.query(query, params);
    const rows = rowsResult.rows || [];

    let skipped = 0;
    let inserted = 0;

    for (const row of rows) {
      const appId = String(row.app_id || "").trim();
      const hasExistingVersion = Boolean(row.existing_version_id);

      if (!appId) {
        skipped += 1;
        continue;
      }

      if (hasExistingVersion) {
        skipped += 1;
        continue;
      }

      const action = asActionFromStatus(row.status);
      const releaseChannel = asReleaseChannel(action);
      const versionNo = 1;

      if (!args.dryRun) {
        const insertVersion = await client.query(
          `
            INSERT INTO miniapp_versions (
              app_id,
              version_no,
              source_action,
              release_channel,
              status,
              manifest_hash,
              manifest,
              row_snapshot,
              actor,
              note
            )
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
            RETURNING id
          `,
          [
            appId,
            versionNo,
            action,
            releaseChannel,
            row.status,
            row.manifest_hash,
            row.manifest,
            row.row_snapshot,
            args.actor,
            args.note,
          ],
        );

        const versionId = insertVersion.rows[0].id;

        await client.query(
          `
            INSERT INTO miniapp_releases (app_id, draft_version_id, published_version_id)
            VALUES ($1,$2,$3)
            ON CONFLICT (app_id) DO UPDATE SET
              draft_version_id = COALESCE(miniapp_releases.draft_version_id, EXCLUDED.draft_version_id),
              published_version_id = COALESCE(miniapp_releases.published_version_id, EXCLUDED.published_version_id),
              updated_at = NOW()
          `,
          [
            appId,
            releaseChannel === "draft" ? versionId : null,
            releaseChannel === "published" ? versionId : null,
          ],
        );

        await client.query(
          `
            INSERT INTO miniapp_release_history (
              app_id,
              release_channel,
              from_version_id,
              to_version_id,
              action,
              actor,
              note
            )
            VALUES ($1,$2,$3,$4,$5,$6,$7)
          `,
          [appId, releaseChannel, null, versionId, action, args.actor, args.note],
        );
      }

      inserted += 1;
    }

    if (args.dryRun) {
      await client.query("ROLLBACK");
      console.log("[dry-run] no writes committed");
    } else {
      await client.query("COMMIT");
    }

    console.log(JSON.stringify({
      dry_run: args.dryRun,
      scanned: rows.length,
      inserted,
      skipped,
      actor: args.actor,
    }, null, 2));
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("backfill failed:", error.message || String(error));
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main();
