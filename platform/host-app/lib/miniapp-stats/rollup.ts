/**
 * Stats Rollup Service
 * Aggregates contract events into miniapp_stats table
 * Designed to run as a cron job every 10 minutes
 */

import { supabase, isSupabaseConfigured } from "../supabase";
import type { MiniAppStats as _MiniAppStats } from "./types";
import { getBlockCount } from "../chain/rpc-client";
import type { ChainId } from "../chains/types";

// ============================================================================
// Configuration
// ============================================================================

const ROLLUP_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
const BLOCKS_PER_ROLLUP = 1000; // Process up to 1000 blocks per run

// Chain to process (Neo N3 TestNet by default)
const DEFAULT_CHAIN_ID: ChainId = "neo-n3-testnet";

// ============================================================================
// Types
// ============================================================================

interface RollupContext {
  chainId: ChainId;
  fromBlock: number;
  toBlock: number;
  fromTimestamp: Date;
  toTimestamp: Date;
  logId: number;
}

interface RollupResult {
  success: boolean;
  appsProcessed: number;
  eventsProcessed: number;
  transactionsProcessed: number;
  error?: string;
}

// ============================================================================
// Main Rollup Function
// ============================================================================

/**
 * Execute stats rollup
 * This is the main entry point for the cron job
 */
export async function executeRollup(chainId: ChainId = DEFAULT_CHAIN_ID): Promise<RollupResult> {
  if (!isSupabaseConfigured) {
    return { success: false, appsProcessed: 0, eventsProcessed: 0, transactionsProcessed: 0, error: "Supabase not configured" };
  }

  const logEntry = await createRollupLog(chainId);
  
  try {
    // Get rollup range
    const context = await getRollupContext(chainId, logEntry.id);
    
    // Process events
    const result = await processRollup(context);
    
    // Mark rollup as complete
    await completeRollupLog(logEntry.id, result);
    
    return result;
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    await failRollupLog(logEntry.id, error);
    return { success: false, appsProcessed: 0, eventsProcessed: 0, transactionsProcessed: 0, error };
  }
}

// ============================================================================
// Rollup Context
// ============================================================================

async function createRollupLog(chainId: ChainId): Promise<{ id: number }> {
  const { data, error } = await supabase
    .from("stats_rollup_log")
    .insert({
      status: "running",
      triggered_by: "cron",
      metadata: { chain_id: chainId },
    })
    .select("id")
    .single();

  if (error) throw new Error(`Failed to create rollup log: ${error.message}`);
  return { id: data!.id as number };
}

async function getRollupContext(chainId: ChainId, logId: number): Promise<RollupContext> {
  // Get current block height
  const currentBlock = await getBlockCount(chainId);
  
  // Get last rollup position
  const { data: lastRollup } = await supabase
    .from("stats_rollup_log")
    .select("to_block, to_timestamp")
    .eq("status", "completed")
    .order("completed_at", { ascending: false })
    .limit(1)
    .single();

  const fromBlock = lastRollup?.to_block 
    ? (lastRollup.to_block as number) + 1 
    : Math.max(0, currentBlock - BLOCKS_PER_ROLLUP);
  
  const toBlock = Math.min(currentBlock, fromBlock + BLOCKS_PER_ROLLUP);
  
  const now = new Date();
  const fromTimestamp = lastRollup?.to_timestamp 
    ? new Date(lastRollup.to_timestamp as string)
    : new Date(now.getTime() - ROLLUP_INTERVAL_MS);

  return {
    chainId,
    fromBlock,
    toBlock,
    fromTimestamp,
    toTimestamp: now,
    logId,
  };
}

// ============================================================================
// Event Processing
// ============================================================================

interface ContractEventRow {
  id: number;
  app_id: string;
  event_name: string;
  tx_hash: string;
  sender?: string;
  block_number: number | null;
  data: Record<string, unknown> | null;
  created_at: string;
}

async function processRollup(context: RollupContext): Promise<RollupResult> {
  const { fromTimestamp, toTimestamp } = context;
  
  // Fetch new events since last rollup
  const { data: events, error } = await supabase
    .from("contract_events")
    .select("*")
    .gte("created_at", fromTimestamp.toISOString())
    .lte("created_at", toTimestamp.toISOString());

  if (error) throw new Error(`Failed to fetch events: ${error.message}`);

  const eventList = (events || []) as ContractEventRow[];
  
  // Group events by app
  const eventsByApp = groupEventsByApp(eventList);
  
  // Aggregate stats for each app
  let appsProcessed = 0;
  let transactionsProcessed = 0;
  
  for (const [appId, appEvents] of Object.entries(eventsByApp)) {
    await updateAppStats(appId, appEvents as ContractEventRow[], context);
    appsProcessed++;
    transactionsProcessed += new Set(appEvents.map((e: { tx_hash: string }) => e.tx_hash)).size;
  }

  // Update rollup log with block range
  await supabase
    .from("stats_rollup_log")
    .update({
      from_block: context.fromBlock,
      to_block: context.toBlock,
      from_timestamp: context.fromTimestamp.toISOString(),
      to_timestamp: context.toTimestamp.toISOString(),
    })
    .eq("id", context.logId);

  return {
    success: true,
    appsProcessed,
    eventsProcessed: eventList.length,
    transactionsProcessed,
  };
}

function groupEventsByApp(events: ContractEventRow[]): Record<string, ContractEventRow[]> {
  const grouped: Record<string, ContractEventRow[]> = {};
  
  for (const event of events) {
    const appId = event.app_id;
    if (!grouped[appId]) grouped[appId] = [];
    grouped[appId].push(event);
  }
  
  return grouped;
}

// ============================================================================
// Stats Aggregation
// ============================================================================

async function updateAppStats(appId: string, events: ContractEventRow[], _context: RollupContext): Promise<void> {
  // Calculate aggregates
  const txHashes = new Set<string>();
  let eventCount = 0;
  let totalGas = 0n;
  const uniqueUsers = new Set<string>();

  for (const event of events) {
    const e = event;
    
    txHashes.add(e.tx_hash);
    eventCount++;
    
    if (e.sender) uniqueUsers.add(e.sender);
    
    // Extract gas/amount from event data
    const gasConsumed = e.data?.gas_consumed;
    const gas = typeof gasConsumed === 'string' ? BigInt(gasConsumed) : 0n;
    totalGas += gas;
  }

  // Get existing stats
  const { data: existing } = await supabase
    .from("miniapp_stats")
    .select("*")
    .eq("app_id", appId)
    .single();

  if (existing) {
    // Update existing stats
    const newTxCount = (existing.total_transactions as number || 0) + txHashes.size;
    const newEventCount = (existing.events_count as number || 0) + eventCount;
    const newVolume = BigInt(existing.total_volume_gas as string || "0") + totalGas;
    const newUsers = (existing.unique_users as number || 0) + uniqueUsers.size;

    await supabase
      .from("miniapp_stats")
      .update({
        total_transactions: newTxCount,
        events_count: newEventCount,
        total_volume_gas: newVolume.toString(),
        unique_users: newUsers,
        transactions_daily: txHashes.size,
        volume_daily_gas: totalGas.toString(),
        active_users_daily: uniqueUsers.size,
        last_rollup_at: new Date().toISOString(),
      })
      .eq("app_id", appId);
  } else {
    // Create new stats record
    await supabase
      .from("miniapp_stats")
      .insert({
        app_id: appId,
        total_transactions: txHashes.size,
        events_count: eventCount,
        total_volume_gas: totalGas.toString(),
        unique_users: uniqueUsers.size,
        transactions_daily: txHashes.size,
        volume_daily_gas: totalGas.toString(),
        active_users_daily: uniqueUsers.size,
        last_rollup_at: new Date().toISOString(),
      });
  }
}

// ============================================================================
// Rollup Log Management
// ============================================================================

async function completeRollupLog(logId: number, result: RollupResult): Promise<void> {
  await supabase
    .from("stats_rollup_log")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      apps_processed: result.appsProcessed,
      events_processed: result.eventsProcessed,
      transactions_processed: result.transactionsProcessed,
    })
    .eq("id", logId);
}

async function failRollupLog(logId: number, error: string): Promise<void> {
  await supabase
    .from("stats_rollup_log")
    .update({
      status: "failed",
      completed_at: new Date().toISOString(),
      error_message: error,
    })
    .eq("id", logId);
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get rollup status for monitoring
 */
export async function getRollupStatus(): Promise<{
  lastRollup: unknown | null;
  totalRollups: number;
  failedRollups: number;
}> {
  if (!isSupabaseConfigured) {
    return { lastRollup: null, totalRollups: 0, failedRollups: 0 };
  }

  const { data: lastRollup } = await supabase
    .from("stats_rollup_log")
    .select("*")
    .order("completed_at", { ascending: false })
    .limit(1)
    .single();

  const { count: totalRollups } = await supabase
    .from("stats_rollup_log")
    .select("*", { count: "exact", head: true });

  const { count: failedRollups } = await supabase
    .from("stats_rollup_log")
    .select("*", { count: "exact", head: true })
    .eq("status", "failed");

  return {
    lastRollup,
    totalRollups: totalRollups || 0,
    failedRollups: failedRollups || 0,
  };
}

/**
 * Reset rollup position (for debugging)
 */
export async function resetRollup(): Promise<void> {
  if (!isSupabaseConfigured) return;

  await supabase
    .from("stats_rollup_log")
    .delete()
    .neq("id", 0);
}

export {
  ROLLUP_INTERVAL_MS,
  BLOCKS_PER_ROLLUP,
  DEFAULT_CHAIN_ID,
  type RollupContext,
  type RollupResult,
};
