import { fetchMiniAppPolicy } from "../_shared/apps.ts";
import { getChainConfig } from "../_shared/chains.ts";
import { handleCorsPreflight } from "../_shared/cors.ts";
import { normalizeHexBytes } from "../_shared/hex.ts";
import { error, json } from "../_shared/response.ts";
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
    return error(405, "method not allowed", "METHOD_NOT_ALLOWED", req);
  }

  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;

  const rl = await requireRateLimit(req, "emit-event", auth);
  if (rl) return rl;

  let body: EmitEventRequest;
  try {
    body = await req.json();
  } catch {
    return error(400, "invalid JSON body", "INVALID_BODY", req);
  }

  const appId = String(body.app_id ?? "").trim();
  const eventName = String(body.event_name ?? "").trim();
  if (!appId || !eventName) {
    return error(400, "app_id and event_name required", "MISSING_FIELDS", req);
  }

  if (body.state === undefined && body.data !== undefined) {
    return error(400, "event payload must use state (data is not supported)", "INVALID_BODY", req);
  }

  const policy = await fetchMiniAppPolicy(appId, req);
  if (policy instanceof Response) return policy;

  const requestedChainId = String(body.chain_id ?? body.chainId ?? "").trim().toLowerCase();
  const chainId = requestedChainId || policy?.supportedChains?.[0] || "";
  if (!chainId) {
    return error(400, "chain_id required", "CHAIN_ID_REQUIRED", req);
  }
  if (policy?.supportedChains?.length && !policy.supportedChains.includes(chainId)) {
    return error(400, `chain_id not supported by app: ${chainId}`, "CHAIN_NOT_SUPPORTED", req);
  }
  const chain = getChainConfig(chainId);
  if (!chain) return error(400, `unknown chain_id: ${chainId}`, "CHAIN_NOT_FOUND", req);

  const rawContractAddress = String(body.contract_address ?? "").trim();
  const manifestAddress = String(policy?.contracts?.[chainId]?.address ?? "").trim();
  const selectedAddress = rawContractAddress || manifestAddress;
  if (!selectedAddress) {
    return error(400, "contract_address required for emit-event", "CONTRACT_REQUIRED", req);
  }

  let normalizedAddress: string;
  try {
    normalizedAddress = normalizeHexBytes(selectedAddress, 20, "contract_address");
  } catch (err) {
    const msg = err instanceof Error ? err.message : "invalid contract_address";
    return error(400, msg, "INVALID_PARAM", req);
  }

  if (rawContractAddress && manifestAddress) {
    const normalizedManifest = normalizeHexBytes(manifestAddress, 20, "manifest.contracts.address");
    if (normalizedManifest !== normalizedAddress) {
      return error(400, "contract_address does not match manifest", "CONTRACT_MISMATCH", req);
    }
  }

  const txHash = String(body.tx_hash ?? "").trim();
  const blockIndexRaw = body.block_index ?? body.blockIndex;
  let blockIndex: number | null = null;
  if (blockIndexRaw !== undefined && blockIndexRaw !== null && blockIndexRaw !== "") {
    const parsed = Number(blockIndexRaw);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return error(400, "block_index must be a non-negative number", "INVALID_PARAM", req);
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
    return error(500, dbErr.message, "DB_ERROR", req);
  }

  return json({ success: true, app_id: appId, event_name: eventName, chain_id: chainId }, req);
}

Deno.serve(handler);
