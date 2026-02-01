#!/usr/bin/env node
/**
 * Sync BUILTIN_APPS to Supabase miniapp_stats table
 */
require("dotenv").config({ path: "../../.env" });
const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Import BUILTIN_APPS data
const BUILTIN_APPS = require("../lib/builtin-apps").BUILTIN_APPS;

async function syncMiniApps() {
  console.log(`Syncing ${BUILTIN_APPS.length} MiniApps to Supabase...`);

  let synced = 0;
  let errors = 0;

  for (const app of BUILTIN_APPS) {
    const supportedChains = Array.isArray(app.supportedChains) ? app.supportedChains : [];
    const chainContracts = app.chainContracts || {};
    const chainIds = new Set([...supportedChains, ...Object.keys(chainContracts)]);
    if (chainIds.size === 0) continue;

    for (const chainId of chainIds) {
      const record = {
        app_id: app.app_id,
        chain_id: chainId,
        active_users_daily: 0,
        active_users_weekly: 0,
        active_users_monthly: 0,
        total_unique_users: 0,
        total_transactions: 0,
        transactions_24h: 0,
        transactions_7d: 0,
        total_volume_gas: "0",
        volume_24h_gas: "0",
        volume_7d_gas: "0",
        live_data: {},
        rating: 0,
        rating_count: 0,
      };

      const { error } = await supabase.from("miniapp_stats").upsert(record, { onConflict: "app_id,chain_id" });

      if (error) {
        console.error(`Error syncing ${app.app_id} (${chainId}):`, error.message);
        errors++;
      } else {
        synced++;
      }
    }
  }

  console.log(`\nSync complete: ${synced} synced, ${errors} errors`);
}

syncMiniApps().catch(console.error);
