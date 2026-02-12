// Initialize environment validation at startup (fail-fast)
import "../_shared/init.ts";

// Deno global type definitions
declare const Deno: {
  env: { get(key: string): string | undefined };
  serve(handler: (req: Request) => Promise<Response>): void;
};

import { handleCorsPreflight } from "../_shared/cors.ts";
import { getChainConfig } from "../_shared/chains.ts";
import { normalizeUInt160 } from "../_shared/hex.ts";
import { mustGetEnv } from "../_shared/env.ts";
import { upsertMiniAppManifest } from "../_shared/apps.ts";
import { canonicalizeMiniAppManifest, parseMiniAppManifestCore } from "../_shared/manifest.ts";
import { json } from "../_shared/response.ts";
import { errorResponse, validationError, notFoundError } from "../_shared/error-codes.ts";
import { requireRateLimit } from "../_shared/ratelimit.ts";
import { requireScope } from "../_shared/scopes.ts";
import { requireAuth, requirePrimaryWallet } from "../_shared/supabase.ts";

type AppUpdateManifestRequest = {
  chain_id?: string;
  chainId?: string;
  manifest: unknown;
};

// Thin gateway:
// - validates auth + wallet binding + shape
// - enforces manifest policy (assets_allowed=["GAS"], governance_assets_allowed=["NEO"])
// - computes the manifest hash deterministically
// - returns an invocation "intent" for the SDK/wallet to sign and submit
export async function handler(req: Request): Promise<Response> {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;
  if (req.method !== "POST") return errorResponse("METHOD_NOT_ALLOWED", undefined, req);

  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;
  const rl = await requireRateLimit(req, "app-update-manifest", auth);
  if (rl) return rl;
  const scopeCheck = requireScope(req, auth, "app-update-manifest");
  if (scopeCheck) return scopeCheck;
  const walletCheck = await requirePrimaryWallet(auth.userId, req);
  if (walletCheck instanceof Response) return walletCheck;

  let body: AppUpdateManifestRequest;
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
    mode: "update",
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
    method: "updateApp",
    params: [
      { type: "String", value: core.appId },
      { type: "ByteArray", value: core.manifestHashHex },
      { type: "String", value: entryUrl },
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

if (import.meta.main) {
  Deno.serve(handler);
}
