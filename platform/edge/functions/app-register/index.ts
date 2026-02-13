// Initialize environment validation at startup (fail-fast)
import "../_shared/init.ts";
import "../_shared/deno.d.ts";

import { createHandler } from "../_shared/handler.ts";
import { getChainConfig } from "../_shared/chains.ts";
import { normalizeUInt160 } from "../_shared/hex.ts";
import { mustGetEnv } from "../_shared/env.ts";
import { upsertMiniAppManifest } from "../_shared/apps.ts";
import { canonicalizeMiniAppManifest, parseMiniAppManifestCore } from "../_shared/manifest.ts";
import { json } from "../_shared/response.ts";
import { errorResponse, validationError, notFoundError } from "../_shared/error-codes.ts";

type AppRegisterRequest = {
  chain_id?: string;
  chainId?: string;
  manifest: unknown;
};

// Thin gateway:
// - validates auth + wallet binding + shape
// - enforces manifest policy (assets_allowed=["GAS"], governance_assets_allowed=["NEO"])
// - computes the manifest hash deterministically
// - returns an invocation "intent" for the SDK/wallet to sign and submit
export const handler = createHandler(
  { method: "POST", auth: "user", rateLimit: "app-register", scope: "app-register", requireWallet: true },
  async ({ req, auth }) => {
    let body: AppRegisterRequest;
    try {
      body = await req.json();
    } catch {
      return errorResponse("BAD_JSON", undefined, req);
    }

    const manifest = body?.manifest;
    if (!manifest) return validationError("manifest", "manifest required", req);

    let core;
    let canonical;
    try {
      core = await parseMiniAppManifestCore(manifest);
      canonical = canonicalizeMiniAppManifest(manifest);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      return errorResponse("VAL_001", { message }, req);
    }

    const upsertErr = await upsertMiniAppManifest({
      core,
      canonicalManifest: canonical,
      developerUserId: auth.userId,
      mode: "register",
      req,
    });
    if (upsertErr) return upsertErr;

    const requestedChainId = String(body.chain_id ?? body.chainId ?? "")
      .trim()
      .toLowerCase();
    const chainId = requestedChainId || core.supportedChains[0] || "";
    if (!chainId) {
      return validationError("chain_id", "chain_id required", req);
    }
    if (!core.supportedChains.includes(chainId)) {
      return errorResponse("VAL_006", { chain_id: chainId }, req);
    }
    const chain = getChainConfig(chainId);
    if (!chain) {
      return notFoundError("chain", req);
    }

    const contractEntry = core.contracts[chainId];
    if (!contractEntry?.address) {
      return errorResponse("VAL_003", { field: "contracts", chain: chainId }, req);
    }

    const entryUrl = contractEntry.entry_url || core.entryUrl;
    const appRegistryAddress = normalizeUInt160(
      chain.contracts?.app_registry || mustGetEnv("CONTRACT_APP_REGISTRY_ADDRESS")
    );
    if (!appRegistryAddress) {
      return errorResponse("SERVER_003", { message: `app_registry contract not configured for ${chainId}` }, req);
    }
    const requestId = crypto.randomUUID();

    const invocation = {
      chain_id: chainId,
      chain_type: chain.type,
      contract_address: appRegistryAddress,
      method: "registerApp",
      params: [
        { type: "String", value: core.appId },
        { type: "ByteArray", value: core.manifestHashHex },
        { type: "String", value: entryUrl },
        { type: "ByteArray", value: core.developerPubKeyHex },
        { type: "ByteArray", value: contractEntry.address },
        { type: "String", value: core.name },
        { type: "String", value: core.description },
        { type: "String", value: core.icon },
        { type: "String", value: core.banner },
        { type: "String", value: core.category },
      ],
    };

    return json(
      {
        request_id: requestId,
        user_id: auth.userId,
        intent: "apps",
        manifest_hash: core.manifestHashHex,
        chain_id: chainId,
        chain_type: chain.type,
        invocation,
      },
      {},
      req
    );
  }
);

if (import.meta.main) {
  Deno.serve(handler);
}
