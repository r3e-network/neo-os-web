/**
 * credits-settler — periodic settlement batcher (cron-able; X-Cron-Secret).
 *
 * POST { network [, dry_run] [, max_users] }
 *
 * Aggregates per-user net spend deltas over the contiguous credit_events
 * window since the last submitted/confirmed epoch and posts ONE
 * operator-signed MiniAppCredits.postSettlement(epoch, users[], deltas[])
 * batch via TxProxy, so the chain remains the auditable checkpoint of the
 * DB-first ledger. Epoch numbering follows the CONTRACT (epoch must equal
 * currentEpoch + 1); the DB credit_epochs rows are bookkeeping.
 *
 * Pipeline per run:
 *   1. Reconcile any 'submitted' epoch first (application log => confirmed /
 *      failed; chain currentEpoch >= epoch proves it landed even when the log
 *      fetch fails; a FAULT or a confirm-timeout with an unconsumed epoch
 *      number marks 'failed', which releases the window for re-aggregation).
 *   2. Prepare the next epoch window via credits_prepare_epoch (caps distinct
 *      users at the contract's 500 batch limit by shrinking the window).
 *   3. Submit postSettlement through TxProxy and record request_id/tx_hash.
 *
 * Reconciliation rule (docs/MINIAPP_CREDITS_LEDGER.md): settled chain state +
 * unsettled DB spend deltas = current truth. On divergence, purchases replay
 * from chain and spends replay from the credit_events log; the contract
 * clamps each per-user debit at the settled balance, so re-posting a window
 * that partially landed can never over-debit below zero.
 */

import { handleCorsPreflight } from "../_shared/cors.ts";
import { readJsonBody } from "../_shared/request.ts";
import { getEnv } from "../_shared/env.ts";
import { error, json } from "../_shared/response.ts";
import { supabaseServiceClient } from "../_shared/supabase.ts";
import { addressToScriptHash } from "../_shared/neo.ts";
import { rpcCall } from "../_shared/neo-rpc.ts";
import { invokeOSContract, parseInvokeResultValue } from "../_shared/os-service.ts";
import { invokeViaTxProxy, type TxProxyParam } from "../_shared/txproxy.ts";
import { getCreditsContractHash, parseCreditsNetwork, requireCronAuth } from "../_shared/credits.ts";

const MAX_USERS_HARD_CAP = 500;

type SettlerBody = {
  network?: string;
  dry_run?: boolean;
  max_users?: number | string;
};

type EpochRow = {
  epoch: number;
  tx_hash: string | null;
  submitted_at: string | null;
};

type PreparedRow = {
  epoch: number;
  from_event_id: number;
  through_event_id: number;
  wallet_address: string;
  delta: number;
};

function confirmTimeoutMs(): number {
  const raw = Number.parseInt(getEnv("CREDITS_SETTLER_CONFIRM_TIMEOUT_MINUTES") ?? "", 10);
  const minutes = Number.isFinite(raw) && raw > 0 ? raw : 30;
  return minutes * 60_000;
}

/** True when every execution in a getapplicationlog result HALTed. */
function txHalted(appLog: unknown): boolean {
  if (!appLog || typeof appLog !== "object") return false;
  const executions = (appLog as Record<string, unknown>).executions;
  if (!Array.isArray(executions) || executions.length === 0) return false;
  return executions.every((execution) =>
    Boolean(execution) && typeof execution === "object" &&
    String((execution as Record<string, unknown>).vmstate ?? "") === "HALT"
  );
}

async function readChainEpoch(contractHash: string): Promise<bigint> {
  const result = await invokeOSContract(contractHash, "currentEpoch", []);
  const value = parseInvokeResultValue(result);
  const raw = String(value ?? "");
  if (!/^\d+$/.test(raw)) throw new Error(`unexpected currentEpoch result: ${raw || "empty"}`);
  return BigInt(raw);
}

export async function handler(req: Request): Promise<Response> {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;
  if (req.method !== "POST") return error(405, "method not allowed", "METHOD_NOT_ALLOWED", req);

  const cronCheck = await requireCronAuth(req);
  if (cronCheck) return cronCheck;

  const bodyOrErr = await readJsonBody<SettlerBody>(req);
  if (bodyOrErr instanceof Response) return bodyOrErr;
  const body = bodyOrErr;

  const network = parseCreditsNetwork(body.network);
  if (!network) return error(400, "network must be mainnet or testnet", "INVALID_NETWORK", req);

  const contractHash = getCreditsContractHash(network);
  if (!contractHash) {
    return error(503, "MiniAppCredits contract hash not configured", "NOT_CONFIGURED", req);
  }

  const rawMaxUsers = Number.parseInt(String(body.max_users ?? ""), 10);
  const maxUsers = Number.isFinite(rawMaxUsers) && rawMaxUsers > 0
    ? Math.min(rawMaxUsers, MAX_USERS_HARD_CAP)
    : MAX_USERS_HARD_CAP;

  const supabase = supabaseServiceClient();

  let chainEpoch: bigint;
  try {
    chainEpoch = await readChainEpoch(contractHash);
  } catch (e) {
    return error(502, e instanceof Error ? e.message : "failed to read chain epoch", "RPC_ERROR", req);
  }

  // -------------------------------------------------------------------------
  // 1. Reconcile previously submitted epochs.
  // -------------------------------------------------------------------------
  const { data: submittedRows, error: submittedErr } = await supabase
    .from("credit_epochs")
    .select("epoch,tx_hash,submitted_at")
    .eq("network", network)
    .eq("status", "submitted")
    .order("epoch", { ascending: true });
  if (submittedErr) return error(500, "failed to load epochs", "DB_ERROR", req);

  for (const row of (submittedRows ?? []) as EpochRow[]) {
    let resolved: "confirmed" | "failed" | null = null;
    let note: string | null = null;

    if (row.tx_hash) {
      try {
        const appLog = await rpcCall<unknown>("getapplicationlog", [row.tx_hash]);
        resolved = txHalted(appLog) ? "confirmed" : "failed";
        if (resolved === "failed") note = "settlement tx FAULTed";
      } catch {
        // Log unavailable: fall through to the epoch-consumption check below.
      }
    }

    if (!resolved) {
      if (chainEpoch >= BigInt(row.epoch)) {
        // The epoch number was consumed on-chain (settler/owner witness only),
        // so the settlement landed even though the log fetch failed.
        resolved = "confirmed";
        note = "confirmed via chain epoch progression";
      } else {
        const submittedAt = row.submitted_at ? Date.parse(row.submitted_at) : NaN;
        const expired = Number.isFinite(submittedAt) && Date.now() - submittedAt > confirmTimeoutMs();
        if (expired) {
          // Epoch number NOT consumed on-chain and the tx never surfaced:
          // safe to release the window for a retry.
          resolved = "failed";
          note = "confirmation timeout; epoch not consumed on-chain";
        }
      }
    }

    if (!resolved) {
      return json(
        { network, status: "waiting_confirmation", epoch: row.epoch, tx_hash: row.tx_hash, chain_epoch: Number(chainEpoch) },
        {},
        req,
      );
    }

    const { error: updateErr } = await supabase
      .from("credit_epochs")
      .update(
        resolved === "confirmed"
          ? { status: "confirmed", confirmed_at: new Date().toISOString(), error_message: note }
          : { status: "failed", error_message: note },
      )
      .eq("network", network)
      .eq("epoch", row.epoch)
      .eq("status", "submitted");
    if (updateErr) return error(500, "failed to update epoch status", "DB_ERROR", req);
  }

  // -------------------------------------------------------------------------
  // 2. Prepare the next epoch window (contract requires currentEpoch + 1).
  // -------------------------------------------------------------------------
  const nextEpoch = chainEpoch + 1n;

  const { data: prepared, error: prepareErr } = await supabase.rpc("credits_prepare_epoch", {
    p_network: network,
    p_epoch: Number(nextEpoch),
    p_max_users: maxUsers,
  });
  if (prepareErr) {
    return error(500, `failed to prepare epoch: ${prepareErr.message ?? "db error"}`, "DB_ERROR", req);
  }

  const rows = (Array.isArray(prepared) ? prepared : []) as PreparedRow[];
  if (rows.length === 0) {
    return json(
      { network, status: "nothing_to_settle", chain_epoch: Number(chainEpoch) },
      {},
      req,
    );
  }

  const totalDelta = rows.reduce((sum, row) => sum + Number(row.delta), 0);
  const batch = {
    network,
    epoch: Number(nextEpoch),
    from_event_id: rows[0].from_event_id,
    through_event_id: rows[0].through_event_id,
    user_count: rows.length,
    total_delta: totalDelta,
  };

  if (body.dry_run === true) {
    return json(
      {
        ...batch,
        status: "dry_run",
        users: rows.map((row) => ({ wallet: row.wallet_address, delta: Number(row.delta) })),
      },
      {},
      req,
    );
  }

  // -------------------------------------------------------------------------
  // 3. Submit postSettlement through TxProxy (settler-key signed).
  // -------------------------------------------------------------------------
  let userParams: TxProxyParam[];
  try {
    userParams = rows.map((row) => ({ type: "Hash160", value: addressToScriptHash(row.wallet_address) }));
  } catch (e) {
    return error(500, e instanceof Error ? e.message : "invalid wallet in batch", "INTERNAL_ERROR", req);
  }
  const deltaParams: TxProxyParam[] = rows.map((row) => ({ type: "Integer", value: String(row.delta) }));

  const requestId = crypto.randomUUID();
  const { error: markErr } = await supabase
    .from("credit_epochs")
    .update({ request_id: requestId })
    .eq("network", network)
    .eq("epoch", Number(nextEpoch))
    .eq("status", "pending");
  if (markErr) return error(500, "failed to record settlement request", "DB_ERROR", req);

  let txHash: string | null = null;
  try {
    const invokeResult = await invokeViaTxProxy({
      request_id: requestId,
      intent: "credits-settlement",
      contract_hash: contractHash,
      method: "postSettlement",
      params: [
        { type: "Integer", value: nextEpoch.toString() },
        { type: "Array", value: userParams },
        { type: "Array", value: deltaParams },
      ],
      wait: false,
    });
    txHash = invokeResult.tx_hash || null;
  } catch (e) {
    const message = e instanceof Error ? e.message : "settlement submission failed";
    await supabase
      .from("credit_epochs")
      .update({ status: "failed", error_message: message })
      .eq("network", network)
      .eq("epoch", Number(nextEpoch))
      .eq("status", "pending");
    return error(502, message, "TXPROXY_ERROR", req);
  }

  const { error: submitErr } = await supabase
    .from("credit_epochs")
    .update({ status: "submitted", tx_hash: txHash, submitted_at: new Date().toISOString() })
    .eq("network", network)
    .eq("epoch", Number(nextEpoch))
    .eq("status", "pending");
  if (submitErr) {
    // The tx is in flight; the next run reconciles via chain epoch progression.
    console.error("[credits-settler] failed to mark epoch submitted", { network, epoch: Number(nextEpoch), txHash });
  }

  return json(
    { ...batch, status: "submitted", request_id: requestId, tx_hash: txHash },
    { status: 201 },
    req,
  );
}

if (import.meta.main) {
  Deno.serve(handler);
}
