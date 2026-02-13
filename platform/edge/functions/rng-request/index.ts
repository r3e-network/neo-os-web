// Initialize environment validation at startup (fail-fast)
import "../_shared/init.ts";

// Deno global type definitions
import "../_shared/deno.d.ts";

import { getChainConfig } from "../_shared/chains.ts";
import { normalizeUInt160 } from "../_shared/hex.ts";
import { getEnv, mustGetEnv } from "../_shared/env.ts";
import { json } from "../_shared/response.ts";
import { errorResponse, validationError, notFoundError } from "../_shared/error-codes.ts";
import { postJSON } from "../_shared/tee.ts";
import { fetchMiniAppPolicy, permissionEnabled } from "../_shared/apps.ts";
import { createHandler } from "../_shared/handler.ts";

type RNGRequest = {
  app_id: string;
  chain_id?: string;
  chainId?: string;
};

export const handler = createHandler(
  { method: "POST", rateLimit: "rng-request", hostScope: "rng-request" },
  async ({ req, auth }) => {
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
    if (chain.type !== "neo-n3") {
      return errorResponse("VAL_008", { message: `unsupported chain type: ${chain.type}` }, req);
    }

    const requestId = crypto.randomUUID();

    // Neo N3 TEE VRF Flow: Direct randomness from TEE service

    const neovrfURL = mustGetEnv("NEOVRF_URL");
    const vrfResult = await postJSON(
      `${neovrfURL.replace(/\/$/, "")}/random`,
      { request_id: requestId },
      { "X-User-ID": auth.userId },
      req
    );
    if (vrfResult instanceof Response) return vrfResult;

    const vrfRecord = vrfResult as Record<string, unknown>;
    const responseId = String(vrfRecord?.request_id ?? "").trim();
    if (responseId && responseId !== requestId) {
      return errorResponse("SERVER_002", { message: "vrf request_id mismatch" }, req);
    }

    const randomnessHex = String(vrfRecord?.randomness ?? "").trim();
    const signatureHex = String(vrfRecord?.signature ?? "").trim();
    const publicKeyHex = String(vrfRecord?.public_key ?? "").trim();
    const attestationHex = String(vrfRecord?.attestation_hash ?? "").trim();
    if (!/^[0-9a-fA-F]+$/.test(randomnessHex) || randomnessHex.length < 2) {
      return errorResponse("SERVER_002", { message: "invalid randomness output" }, req);
    }
    const attestationHash = /^[0-9a-fA-F]+$/.test(attestationHex) ? attestationHex : "";
    const signature = /^[0-9a-fA-F]+$/.test(signatureHex) ? signatureHex : "";
    const publicKey = /^[0-9a-fA-F]+$/.test(publicKeyHex) ? publicKeyHex : "";

    // Optional on-chain anchoring (RandomnessLog.record) via txproxy.
    let anchoredTx: unknown = undefined;
    if (getEnv("RNG_ANCHOR") === "1") {
      const txproxyURL = mustGetEnv("TXPROXY_URL");
      const randomnessLogAddress = normalizeUInt160(
        chain.contracts?.randomness_log || mustGetEnv("CONTRACT_RANDOMNESS_LOG_ADDRESS")
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
        req
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
      req
    );
  }
);

if (import.meta.main) {
  Deno.serve(handler);
}
