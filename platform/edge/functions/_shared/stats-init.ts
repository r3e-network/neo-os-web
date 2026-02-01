/**
 * Stats Initialization Helper
 * Provides functions for eager and lazy stats creation
 */

import { supabaseServiceClient } from "./supabase.ts";

/**
 * Initialize stats for a newly registered miniapp (eager creation)
 * Called after successful upsert in app-register
 * Non-blocking - failures are logged but don't fail registration
 */
export async function initializeStatsForApp(
  appId: string,
  supportedChains: string[],
): Promise<{ success: boolean; created: number; error?: string }> {
  try {
    const supabase = supabaseServiceClient();
    const chains = supportedChains.length > 0 ? supportedChains : ["neo-n3-mainnet"];

    const { data, error } = await supabase.rpc("initialize_miniapp_stats_all_chains", {
      p_app_id: appId,
      p_chains: chains,
    });

    if (error) {
      console.warn(`[stats-init] Failed to initialize stats for ${appId}:`, error.message);
      return { success: false, created: 0, error: error.message };
    }

    console.log(`[stats-init] Created ${data} stats records for ${appId}`);
    return { success: true, created: data ?? chains.length };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.warn(`[stats-init] Exception initializing stats for ${appId}:`, message);
    return { success: false, created: 0, error: message };
  }
}

/**
 * Ensure stats exist for a specific app-chain combination (lazy creation)
 * Called on first view or transaction if stats don't exist
 */
export async function ensureStatsExist(appId: string, chainId: string = "neo-n3-mainnet"): Promise<boolean> {
  try {
    const supabase = supabaseServiceClient();

    const { data, error } = await supabase.rpc("ensure_miniapp_stats_exist", {
      p_app_id: appId,
      p_chain_id: chainId,
    });

    if (error) {
      console.warn(`[stats-init] Lazy creation failed for ${appId}/${chainId}:`, error.message);
      return false;
    }

    if (data === true) {
      console.log(`[stats-init] Lazy-created stats for ${appId}/${chainId}`);
    }

    return true;
  } catch (err) {
    console.warn(`[stats-init] Exception in lazy creation:`, err);
    return false;
  }
}
