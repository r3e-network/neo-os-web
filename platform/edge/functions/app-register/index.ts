import { handleCorsPreflight } from "../_shared/cors.ts";
import { getChainConfig } from "../_shared/chains.ts";
import { normalizeUInt160 } from "../_shared/contracts.ts";
import { mustGetEnv } from "../_shared/env.ts";
import { upsertMiniAppManifest } from "../_shared/apps.ts";
import { canonicalizeMiniAppManifest, parseMiniAppManifestCore } from "../_shared/manifest.ts";
import { error, json } from "../_shared/response.ts";
import { requireRateLimit } from "../_shared/ratelimit.ts";
import { requireScope } from "../_shared/scopes.ts";
import { requireAuth, requirePrimaryWallet } from "../_shared/supabase.ts";
import { encodeAppRegistryCall } from "../_shared/evm.ts";

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
export async function handler(req: Request): Promise<Response> {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;
  if (req.method !== "POST") return error(405, "method not allowed", "METHOD_NOT_ALLOWED", req);

  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;
  const rl = await requireRateLimit(req, "app-register", auth);
  if (rl) return rl;
  const scopeCheck = requireScope(req, auth, "app-register");
  if (scopeCheck) return scopeCheck;
  const walletCheck = await requirePrimaryWallet(auth.userId, req);
  if (walletCheck instanceof Response) return walletCheck;

  let body: AppRegisterRequest;
  try {
    body = await req.json();
  } catch {
    return error(400, "invalid JSON body", "BAD_JSON", req);
  }

  const manifest = body?.manifest;
  if (!manifest) return error(400, "manifest required", "MANIFEST_REQUIRED", req);

  let core;
  let canonical;
  try {
    core = await parseMiniAppManifestCore(manifest);
    canonical = canonicalizeMiniAppManifest(manifest);
  } catch (e) {
    return error(400, (e as Error).message, "BAD_INPUT", req);
  }

  const upsertErr = await upsertMiniAppManifest({
    core,
    canonicalManifest: canonical,
    developerUserId: auth.userId,
    mode: "register",
    req,
  });
  if (upsertErr) return upsertErr;

  const requestedChainId = String(body.chain_id ?? body.chainId ?? "").trim().toLowerCase();
  const chainId = requestedChainId || core.supportedChains[0] || "";
  if (!chainId) {
    return error(400, "chain_id required", "CHAIN_ID_REQUIRED", req);
  }
  if (!core.supportedChains.includes(chainId)) {
    return error(400, `chain_id not supported by app: ${chainId}`, "CHAIN_NOT_SUPPORTED", req);
  }
  const chain = getChainConfig(chainId);
  if (!chain) {
    return error(400, `unknown chain_id: ${chainId}`, "CHAIN_NOT_FOUND", req);
  }

  const contractEntry = core.contracts[chainId];
  if (!contractEntry?.address) {
    return error(400, `manifest.contracts missing address for ${chainId}`, "CONTRACT_MISSING", req);
  }

  const entryUrl = contractEntry.entry_url || core.entryUrl;
  const appRegistryAddress =
    chain.contracts?.app_registry || (chain.type === "neo-n3" ? mustGetEnv("CONTRACT_APP_REGISTRY_ADDRESS") : "");
  if (!appRegistryAddress) {
    return error(500, `app_registry contract not configured for ${chainId}`, "APP_REGISTRY_MISSING", req);
  }
  const appRegistryHash = chain.type === "neo-n3" ? normalizeUInt160(appRegistryAddress) : appRegistryAddress;
  const requestId = crypto.randomUUID();

  const hexWith0x = (value: string) => (value.startsWith("0x") ? value : `0x${value}`);

  const invocation =
    chain.type === "neo-n3"
      ? {
          chain_id: chainId,
          chain_type: chain.type,
          contract_address: appRegistryHash,
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
        }
      : {
          chain_id: chainId,
          chain_type: chain.type,
          contract_address: hexWith0x(appRegistryAddress),
          method: "registerApp",
          args: [
            core.appId,
            hexWith0x(core.manifestHashHex),
            entryUrl,
            hexWith0x(core.developerPubKeyHex),
            hexWith0x(contractEntry.address),
            core.name,
            core.description,
            core.icon,
            core.banner,
            core.category,
          ],
          data: encodeAppRegistryCall("registerApp", [
            core.appId,
            hexWith0x(core.manifestHashHex),
            entryUrl,
            hexWith0x(core.developerPubKeyHex),
            hexWith0x(contractEntry.address),
            core.name,
            core.description,
            core.icon,
            core.banner,
            core.category,
          ]),
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
    req,
  );
}

if (import.meta.main) {
  Deno.serve(handler);
}
