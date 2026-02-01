// Initialize environment validation at startup (fail-fast)
import "../_shared/init.ts";

// Deno global type definitions
declare const Deno: {
  env: { get(key: string): string | undefined };
  serve(handler: (req: Request) => Promise<Response>): void;
};

import { fetchMiniAppPolicy } from "../_shared/apps.ts";
import { getChainConfig } from "../_shared/chains.ts";
import { handleCorsPreflight } from "../_shared/cors.ts";
import { normalizeHexBytes } from "../_shared/hex.ts";
import { json } from "../_shared/response.ts";
import { errorResponse, validationError, notFoundError } from "../_shared/error-codes.ts";
import { supabaseClient, requireAuth } from "../_shared/supabase.ts";
import { requireRateLimit } from "../_shared/ratelimit.ts";

type EmitEventRequest = {
  app_id?: string;
  event_name?: string;
  state?: unknown;
  chain_id?: string;
  chainId?: string;
  contract_address?: string;
  tx_hash?: string;
  block_index?: number;
  blockIndex?: number;
  data?: unknown;
};

export async function handler(req: Request): Promise<Response> {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;
  if (req.method !== "POST") {
    return errorResponse("METHOD_NOT_ALLOWED", undefined, req);
  }

  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;

  const rl = await requireRateLimit(req, "emit-event", auth);
  if (rl) return rl;

  let body: EmitEventRequest;
  try {
    body = await req.json();
  } catch {
    return errorResponse("BAD_JSON", undefined, req);
  }

  const appId = String(body.app_id ?? "").trim();
  const eventName = String(body.event_name ?? "").trim();
  if (!appId || !eventName) {
    return errorResponse("VAL_003", { field: "app_id,event_name" }, req);
  }

  if (body.state === undefined && body.data !== undefined) {
    return errorResponse("VAL_002", { message: "event payload must use state (data is not supported)" }, req);
  }

  const policy = await fetchMiniAppPolicy(appId, req);
  if (policy instanceof Response) return policy;

  const requestedChainId = String(body.chain_id ?? body.chainId ?? "")
    .trim()
    .toLowerCase();
  const chainId = requestedChainId || policy?.supportedChains?.[0] || "";
  if (!chainId) {
    return validationError("chain_id", "chain_id required", req);
  }
  if (policy?.supportedChains?.length && !policy.supportedChains.includes(chainId)) {
    return errorResponse("VAL_006", { chain_id: chainId }, req);
  }
  const chain = getChainConfig(chainId);
  if (!chain) {
    return notFoundError("chain", req);
  }

  const rawContractAddress = String(body.contract_address ?? "").trim();
  const manifestAddress = String(policy?.contracts?.[chainId]?.address ?? "").trim();
  const selectedAddress = rawContractAddress || manifestAddress;
  if (!selectedAddress) {
    return validationError("contract_address", "contract_address required for emit-event", req);
  }

  let normalizedAddress: string;
  try {
    normalizedAddress = normalizeHexBytes(selectedAddress, 20, "contract_address");
  } catch (err) {
    const msg = err instanceof Error ? err.message : "invalid contract_address";
    return errorResponse("VAL_002", { field: "contract_address", message: msg }, req);
  }

  if (rawContractAddress && manifestAddress) {
    const normalizedManifest = normalizeHexBytes(manifestAddress, 20, "manifest.contracts.address");
    if (normalizedManifest !== normalizedAddress) {
      return errorResponse("VAL_005", { message: "contract_address does not match manifest" }, req);
    }
  }

  const txHash = String(body.tx_hash ?? "").trim();
  const blockIndexRaw = body.block_index ?? body.blockIndex;
  let blockIndex: number | null = null;
  if (blockIndexRaw !== undefined && blockIndexRaw !== null) {
    const parsed = Number(blockIndexRaw);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return errorResponse(
        "VAL_002",
        { field: "block_index", message: "block_index must be a non-negative number" },
        req
      );
    }
    blockIndex = Math.floor(parsed);
  }

  const supabase = supabaseClient();
  const record: Record<string, unknown> = {
    app_id: appId,
    chain_id: chainId,
    contract_address: normalizedAddress,
    event_name: eventName,
    state: body.state ?? {},
    created_at: new Date().toISOString(),
  };
  if (txHash) record.tx_hash = txHash;
  if (blockIndex !== null) record.block_index = blockIndex;

  const { error: dbErr } = await supabase.from("contract_events").insert(record);

  if (dbErr) {
    return errorResponse("SERVER_002", { message: dbErr.message }, req);
  }

  return json({ success: true, app_id: appId, event_name: eventName, chain_id: chainId }, {}, req);
}

if (import.meta.main) {
  Deno.serve(handler);
}
