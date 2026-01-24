// Initialize environment validation at startup (fail-fast)
import "../_shared/init.ts";

import { handleCorsPreflight } from "../_shared/cors.ts";
import { getChainConfig } from "../_shared/chains.ts";
import { normalizeUInt160 } from "../_shared/contracts.ts";
import { getEnv, mustGetEnv } from "../_shared/env.ts";
import { json } from "../_shared/response.ts";
import { errorResponse, validationError, notFoundError } from "../_shared/error-codes.ts";
import { requireRateLimit } from "../_shared/ratelimit.ts";
import { requireScope } from "../_shared/scopes.ts";
import { requireAuth, requirePrimaryWallet } from "../_shared/supabase.ts";
import { postJSON } from "../_shared/tee.ts";
import { fetchMiniAppPolicy, permissionEnabled } from "../_shared/apps.ts";
import { encodeVRFRequest, type EVMInvocation } from "../_shared/evm.ts";

type RNGRequest = {
  app_id: string;
  chain_id?: string;
  chainId?: string;
  /** Number of random words to request (EVM VRF only, default 1) */
  num_words?: number;
  /** Callback gas limit for EVM VRF (default 100000) */
  callback_gas_limit?: number;
};

export async function handler(req: Request): Promise<Response> {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;
  if (req.method !== "POST") return errorResponse("METHOD_NOT_ALLOWED", undefined, req);

  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;
  const rl = await requireRateLimit(req, "rng-request", auth);
  if (rl) return rl;
  const scopeCheck = requireScope(req, auth, "rng-request");
  if (scopeCheck) return scopeCheck;
  const walletCheck = await requirePrimaryWallet(auth.userId, req);
  if (walletCheck instanceof Response) return walletCheck;

  let body: RNGRequest;
  try {
    body = await req.json();
  } catch {
    return errorResponse("BAD_JSON", undefined, req);
  }
  const appId = (body.app_id ?? "").trim();
  if (!appId) return validationError("app_id", "app_id required", req);

  const policy = await fetchMiniAppPolicy(appId, req);
  if (policy instanceof Response) return policy;
  if (policy) {
    const allowed = permissionEnabled(policy.permissions, "rng");
    if (!allowed) {
      return errorResponse("AUTH_004", { message: "app is not allowed to request randomness" }, req);
    }
  }

  const requestedChainId = String(body.chain_id ?? body.chainId ?? "")
    .trim()
    .toLowerCase();
  const chainId = requestedChainId || policy?.supportedChains?.[0] || "neo-n3-mainnet";
  if (policy?.supportedChains?.length && !policy.supportedChains.includes(chainId)) {
    return errorResponse("VAL_006", { chain_id: chainId }, req);
  }
  const chain = getChainConfig(chainId);
  if (!chain) return notFoundError("chain", req);

  // Validate chain type is supported
  if (chain.type !== "neo-n3" && chain.type !== "evm") {
    return errorResponse("VAL_008", { message: `unsupported chain type: ${chain.type}` }, req);
  }

  const requestId = crypto.randomUUID();

  // EVM VRF Flow: Return invocation intent for Chainlink VRF or similar
  if (chain.type === "evm") {
    const vrfCoordinator = chain.contracts?.vrf_coordinator;
    if (!vrfCoordinator) {
      return errorResponse("SERVER_001", { message: "vrf_coordinator not configured for chain" }, req);
    }

    const keyHash = chain.contracts?.vrf_key_hash || getEnv("EVM_VRF_KEY_HASH");
    const subId = chain.contracts?.vrf_subscription_id || getEnv("EVM_VRF_SUBSCRIPTION_ID");
    if (!keyHash || !subId) {
      return errorResponse("SERVER_001", { message: "VRF key_hash or subscription_id not configured" }, req);
    }

    const numWords = Math.min(Math.max(body.num_words || 1, 1), 10);
    const callbackGasLimit = Math.min(Math.max(body.callback_gas_limit || 100000, 50000), 500000);
    const minConfirmations = 3;

    const evmInvocation: EVMInvocation = {
      chain_id: chainId,
      chain_type: "evm",
      contract_address: vrfCoordinator,
      data: encodeVRFRequest(keyHash, BigInt(subId), minConfirmations, callbackGasLimit, numWords),
    };

    return json(
      {
        request_id: requestId,
        app_id: appId,
        chain_id: chainId,
        chain_type: chain.type,
        vrf_provider: "chainlink",
        invocation: evmInvocation,
        // EVM VRF is async - randomness delivered via callback
        async: true,
        num_words: numWords,
      },
      {},
      req,
    );
  }

  // Neo N3 TEE VRF Flow: Direct randomness from TEE service

  const neovrfURL = mustGetEnv("NEOVRF_URL");
  const vrfResult = await postJSON(
    `${neovrfURL.replace(/\/$/, "")}/random`,
    { request_id: requestId },
    { "X-User-ID": auth.userId },
    req,
  );
  if (vrfResult instanceof Response) return vrfResult;

  const responseId = String((vrfResult as any)?.request_id ?? "").trim();
  if (responseId && responseId !== requestId) {
    return errorResponse("SERVER_002", { message: "vrf request_id mismatch" }, req);
  }

  const randomnessHex = String((vrfResult as any)?.randomness ?? "").trim();
  const signatureHex = String((vrfResult as any)?.signature ?? "").trim();
  const publicKeyHex = String((vrfResult as any)?.public_key ?? "").trim();
  const attestationHex = String((vrfResult as any)?.attestation_hash ?? "").trim();
  if (!/^[0-9a-fA-F]+$/.test(randomnessHex) || randomnessHex.length < 2) {
    return errorResponse("SERVER_002", { message: "invalid randomness output" }, req);
  }
  const attestationHash = /^[0-9a-fA-F]+$/.test(attestationHex) ? attestationHex : "";
  const signature = /^[0-9a-fA-F]+$/.test(signatureHex) ? signatureHex : "";
  const publicKey = /^[0-9a-fA-F]+$/.test(publicKeyHex) ? publicKeyHex : "";

  // Optional on-chain anchoring (RandomnessLog.record) via txproxy.
  let anchoredTx: unknown = undefined;
  if (getEnv("RNG_ANCHOR") === "1") {
    if (chain.type !== "neo-n3") {
      return errorResponse("VAL_008", { message: "rng anchoring only supported on neo-n3 chains" }, req);
    }
    const txproxyURL = mustGetEnv("TXPROXY_URL");
    const randomnessLogAddress = normalizeUInt160(
      chain.contracts?.randomness_log || mustGetEnv("CONTRACT_RANDOMNESS_LOG_ADDRESS"),
    );
    const timestamp = Math.floor(Date.now() / 1000);
    const reportHashHex = attestationHash || randomnessHex.slice(0, 64);

    const txRes = await postJSON(
      `${txproxyURL.replace(/\/$/, "")}/invoke`,
      {
        request_id: requestId,
        contract_address: randomnessLogAddress,
        method: "record",
        params: [
          { type: "String", value: requestId },
          { type: "ByteArray", value: randomnessHex },
          { type: "ByteArray", value: reportHashHex },
          { type: "Integer", value: String(timestamp) },
        ],
        wait: true,
      },
      { "X-Service-ID": "gateway" },
      req,
    );
    if (txRes instanceof Response) return txRes;
    anchoredTx = txRes;
  }

  return json(
    {
      request_id: requestId,
      app_id: appId,
      chain_id: chainId,
      chain_type: chain.type,
      randomness: randomnessHex,
      signature: signature || undefined,
      public_key: publicKey || undefined,
      attestation_hash: attestationHash || undefined,
      anchored_tx: anchoredTx,
    },
    {},
    req,
  );
}

if (import.meta.main) {
  Deno.serve(handler);
}
