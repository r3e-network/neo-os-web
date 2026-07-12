/**
 * credits-indexer — chain watcher that credits on-chain GAS purchases
 * (CreditsPurchased) into the DB ledger and mirrors on-chain exits
 * (CreditsExited) as clamped DB debits.
 *
 * POST { network [, max_blocks] }   (cron-able; X-Cron-Secret auth)
 *
 * Replay safety:
 *   - progress cursor: credit_indexer_state.last_processed_block per network;
 *     a crashed run resumes from the last fully-processed block.
 *   - notification dedupe: unique (network, tx_hash, event_index) on
 *     credit_events — rescanning a block is a no-op, so the cursor update and
 *     the credits are allowed to be non-transactional.
 *   - first run starts at the current chain head (or the explicit
 *     CREDITS_INDEXER_START_BLOCK override, e.g. the contract deploy block).
 *
 * Reconciliation rule: purchases replay from chain, spends replay from the
 * credit_events log; settled chain state + unsettled DB deltas = truth.
 */

import { handleCorsPreflight } from "../_shared/cors.ts";
import { readJsonBody } from "../_shared/request.ts";
import { getEnv } from "../_shared/env.ts";
import { error, json } from "../_shared/response.ts";
import { supabaseServiceClient } from "../_shared/supabase.ts";
import { rpcCall } from "../_shared/neo-rpc.ts";
import { scriptHashToAddress } from "../_shared/neo.ts";
import {
  extractCreditsChainEvents,
  getCreditsContractHash,
  parseCreditsNetwork,
  requireCronAuth,
} from "../_shared/credits.ts";

const MAX_BLOCKS_HARD_CAP = 500;

type IndexerBody = {
  network?: string;
  max_blocks?: number | string;
};

type BlockResult = {
  index?: number;
  hash?: string;
  tx?: Array<{ hash?: string }>;
};

function defaultMaxBlocks(): number {
  const raw = Number.parseInt(getEnv("CREDITS_INDEXER_MAX_BLOCKS") ?? "", 10);
  return Number.isFinite(raw) && raw > 0 ? Math.min(raw, MAX_BLOCKS_HARD_CAP) : 100;
}

export async function handler(req: Request): Promise<Response> {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;
  if (req.method !== "POST") return error(405, "method not allowed", "METHOD_NOT_ALLOWED", req);

  const cronCheck = await requireCronAuth(req);
  if (cronCheck) return cronCheck;

  const bodyOrErr = await readJsonBody<IndexerBody>(req);
  if (bodyOrErr instanceof Response) return bodyOrErr;
  const body = bodyOrErr;

  const network = parseCreditsNetwork(body.network);
  if (!network) return error(400, "network must be mainnet or testnet", "INVALID_NETWORK", req);

  const contractHash = getCreditsContractHash(network);
  if (!contractHash) {
    return error(503, "MiniAppCredits contract hash not configured", "NOT_CONFIGURED", req);
  }

  const rawMax = Number.parseInt(String(body.max_blocks ?? ""), 10);
  const maxBlocks = Number.isFinite(rawMax) && rawMax > 0
    ? Math.min(rawMax, MAX_BLOCKS_HARD_CAP)
    : defaultMaxBlocks();

  const supabase = supabaseServiceClient();

  // Chain head: getblockcount returns the next block index, so the newest
  // persisted block is count - 1.
  let head: number;
  try {
    const count = await rpcCall<number>("getblockcount", []);
    if (!Number.isFinite(count) || count <= 0) throw new Error("invalid block count");
    head = count - 1;
  } catch (e) {
    return error(502, e instanceof Error ? e.message : "failed to query block count", "RPC_ERROR", req);
  }

  // Cursor bootstrap.
  const { data: stateRow, error: stateErr } = await supabase
    .from("credit_indexer_state")
    .select("last_processed_block")
    .eq("network", network)
    .maybeSingle();
  if (stateErr) return error(500, "failed to load indexer state", "DB_ERROR", req);

  let last: number;
  if (stateRow && Number.isFinite(Number(stateRow.last_processed_block))) {
    last = Number(stateRow.last_processed_block);
  } else {
    const startOverride = Number.parseInt(getEnv("CREDITS_INDEXER_START_BLOCK") ?? "", 10);
    last = Number.isFinite(startOverride) && startOverride >= 0 ? startOverride : head;
    const { error: insertErr } = await supabase
      .from("credit_indexer_state")
      .upsert(
        { network, last_processed_block: last, contract_hash: contractHash, updated_at: new Date().toISOString() },
        { onConflict: "network" },
      );
    if (insertErr) return error(500, "failed to initialize indexer state", "DB_ERROR", req);
  }

  const fromBlock = last + 1;
  const toBlock = Math.min(last + maxBlocks, head);
  if (fromBlock > toBlock) {
    return json(
      { network, contract_hash: contractHash, up_to_date: true, last_processed_block: last, chain_head: head },
      {},
      req,
    );
  }

  let purchasesCredited = 0;
  let exitsApplied = 0;
  let deduped = 0;
  let lastComplete = last;
  let scanError: string | null = null;

  scan: for (let height = fromBlock; height <= toBlock; height++) {
    let block: BlockResult;
    try {
      block = await rpcCall<BlockResult>("getblock", [height, 1]);
    } catch (e) {
      scanError = e instanceof Error ? e.message : "getblock failed";
      break scan;
    }

    const txs = Array.isArray(block?.tx) ? block.tx : [];
    for (const tx of txs) {
      const txHash = String(tx?.hash ?? "").trim();
      if (!/^0x[0-9a-fA-F]{64}$/.test(txHash)) continue;

      let appLog: unknown;
      try {
        appLog = await rpcCall<unknown>("getapplicationlog", [txHash]);
      } catch (e) {
        scanError = e instanceof Error ? e.message : "getapplicationlog failed";
        break scan;
      }

      for (const event of extractCreditsChainEvents(txHash, appLog, contractHash)) {
        let wallet: string;
        try {
          wallet = scriptHashToAddress(event.userHash);
        } catch {
          console.warn("[credits-indexer] skipping event with invalid user hash", { txHash, eventIndex: event.eventIndex });
          continue;
        }

        const rpcName = event.eventName === "CreditsPurchased" ? "credits_credit_purchase" : "credits_apply_exit";
        const rpcArgs = event.eventName === "CreditsPurchased"
          ? {
            p_network: network,
            p_wallet: wallet,
            p_tx_hash: txHash,
            p_event_index: event.eventIndex,
            p_gas_amount: event.gasAmount.toString(),
            p_credits: Number(event.credits),
          }
          : {
            p_network: network,
            p_wallet: wallet,
            p_tx_hash: txHash,
            p_event_index: event.eventIndex,
            p_chain_credits: Number(event.credits),
            p_gas_paid: event.gasAmount.toString(),
          };

        const { data, error: rpcErr } = await supabase.rpc(rpcName, rpcArgs);
        if (rpcErr) {
          scanError = `credit apply failed: ${rpcErr.message ?? "db error"}`;
          break scan;
        }
        const row = Array.isArray(data) ? data[0] : data;
        if (!row?.success) {
          scanError = `credit apply rejected: ${String(row?.error_code ?? "unknown")}`;
          break scan;
        }
        if (row.deduped) deduped += 1;
        else if (event.eventName === "CreditsPurchased") purchasesCredited += 1;
        else exitsApplied += 1;
      }
    }

    lastComplete = height;
  }

  if (lastComplete > last) {
    const { error: cursorErr } = await supabase
      .from("credit_indexer_state")
      .update({
        last_processed_block: lastComplete,
        contract_hash: contractHash,
        updated_at: new Date().toISOString(),
      })
      .eq("network", network);
    if (cursorErr) {
      // Events are dedupe-protected; a stale cursor only means a rescan.
      console.error("[credits-indexer] cursor update failed", cursorErr.message ?? String(cursorErr));
    }
  }

  const summary = {
    network,
    contract_hash: contractHash,
    from_block: fromBlock,
    to_block: toBlock,
    last_processed_block: lastComplete,
    chain_head: head,
    purchases_credited: purchasesCredited,
    exits_applied: exitsApplied,
    deduped,
    up_to_date: lastComplete >= head,
  };

  if (scanError) {
    console.error("[credits-indexer] partial run", { ...summary, error: scanError });
    return json({ ...summary, partial: true, error: scanError }, { status: 502 }, req);
  }
  return json(summary, {}, req);
}

if (import.meta.main) {
  Deno.serve(handler);
}
