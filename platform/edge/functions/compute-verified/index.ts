/**
 * Compute Verified Edge Function
 *
 * Executes off-chain computation with on-chain script hash verification.
 * Ensures only registered and enabled scripts are executed in TEE.
 *
 * Flow:
 * 1. Receive compute request with contract_hash, script_name, seed, input
 * 2. Load script from CDN by app_id and script_name
 * 3. Verify script hash matches on-chain registered hash
 * 4. Execute script in TEE with seed and input
 * 5. Return result with script hash for on-chain settlement
 */

// Initialize environment validation at startup (fail-fast)
import "../_shared/init.ts";

// Deno global type definitions
declare const Deno: {
  env: { get(key: string): string | undefined };
  serve(handler: (req: Request) => Promise<Response>): void;
};

import { handleCorsPreflight } from "../_shared/cors.ts";
import { mustGetEnv } from "../_shared/env.ts";
import { json } from "../_shared/response.ts";
import { errorResponse, validationError, notFoundError } from "../_shared/error-codes.ts";
import { requireRateLimit } from "../_shared/ratelimit.ts";
import { requireHostScope } from "../_shared/scopes.ts";
import { requireAuth, requirePrimaryWallet } from "../_shared/supabase.ts";
import { postJSON } from "../_shared/tee.ts";
import { computeScriptHash, verifyScript } from "../_shared/script-verify.ts";

type ComputeVerifiedRequest = {
  app_id: string;
  contract_hash: string;
  script_name: string;
  seed: string;
  input?: Record<string, unknown>;
  chain_id?: string;
};

type ScriptManifest = {
  app_id: string;
  tee_scripts?: Record<
    string,
    {
      file: string;
      entry_point: string;
      description?: string;
    }
  >;
};

const SCRIPTS_BASE_URL = mustGetEnv("MINIAPP_SCRIPTS_BASE_URL") || "https://cdn.miniapps.neo.org";

const CHAIN_RPC_URLS: Record<string, string> = {
  "neo3-mainnet": "https://mainnet1.neo.coz.io:443",
  "neo3-testnet": "https://testnet1.neo.coz.io:443",
};

/**
 * Load script content from CDN.
 */
async function loadScript(appId: string, scriptName: string): Promise<{ script: string; entryPoint: string } | null> {
  try {
    const manifestUrl = `${SCRIPTS_BASE_URL}/apps/${appId}/manifest.json`;
    const manifestRes = await fetch(manifestUrl);
    if (!manifestRes.ok) return null;

    const manifest: ScriptManifest = await manifestRes.json();
    const scriptInfo = manifest.tee_scripts?.[scriptName];
    if (!scriptInfo) return null;

    const scriptUrl = `${SCRIPTS_BASE_URL}/apps/${appId}/${scriptInfo.file}`;
    const scriptRes = await fetch(scriptUrl);
    if (!scriptRes.ok) return null;

    return {
      script: await scriptRes.text(),
      entryPoint: scriptInfo.entry_point,
    };
  } catch {
    return null;
  }
}

export async function handler(req: Request): Promise<Response> {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;

  if (req.method !== "POST") {
    return errorResponse("METHOD_NOT_ALLOWED", undefined, req);
  }

  // Auth and rate limiting
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;

  const rl = await requireRateLimit(req, "compute-verified", auth);
  if (rl) return rl;

  const scopeCheck = requireHostScope(req, auth, "compute-verified");
  if (scopeCheck) return scopeCheck;

  const walletCheck = await requirePrimaryWallet(auth.userId, req);
  if (walletCheck instanceof Response) return walletCheck;

  // Parse request
  let body: ComputeVerifiedRequest;
  try {
    body = await req.json();
  } catch {
    return errorResponse("BAD_JSON", undefined, req);
  }

  const appId = String(body.app_id ?? "").trim();
  const contractHash = String(body.contract_hash ?? "").trim();
  const scriptName = String(body.script_name ?? "").trim();
  const seed = String(body.seed ?? "").trim();
  const chainId = String(body.chain_id ?? "neo3-testnet").trim();

  // Validate required fields
  if (!appId) {
    return validationError("app_id", "app_id required", req);
  }
  if (!contractHash) {
    return validationError("contract_hash", "contract_hash required", req);
  }
  if (!scriptName) {
    return validationError("script_name", "script_name required", req);
  }
  if (!seed) {
    return validationError("seed", "seed required", req);
  }

  // Get RPC URL for chain
  const rpcUrl = CHAIN_RPC_URLS[chainId];
  if (!rpcUrl) {
    return errorResponse("VAL_006", { chain_id: chainId }, req);
  }

  // Load script from CDN
  const loaded = await loadScript(appId, scriptName);
  if (!loaded) {
    return notFoundError("script", req);
  }

  // Verify script against on-chain registration
  const verification = await verifyScript(contractHash, scriptName, loaded.script, rpcUrl);

  if (!verification.valid) {
    return errorResponse("AUTH_004", { message: `script verification failed: ${verification.error}` }, req);
  }

  // Compute script hash for response
  const scriptHash = await computeScriptHash(loaded.script);

  // Execute in TEE
  const neocomputeURL = mustGetEnv("NEOCOMPUTE_URL").replace(/\/$/, "");
  const result = await postJSON(
    `${neocomputeURL}/execute`,
    {
      script: loaded.script,
      entry_point: loaded.entryPoint,
      input: {
        ...body.input,
        seed: seed,
      },
      app_id: appId,
      script_name: scriptName,
    },
    { "X-User-ID": auth.userId },
    req
  );

  if (result instanceof Response) return result;

  // Return result with verification info
  return json(
    {
      success: true,
      result: result,
      verification: {
        script_name: scriptName,
        script_hash: scriptHash,
        script_version: verification.scriptInfo?.version,
        verified: true,
      },
    },
    {},
    req
  );
}

if (import.meta.main) {
  Deno.serve(handler);
}
