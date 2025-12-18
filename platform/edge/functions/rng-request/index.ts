import { handleCorsPreflight } from "../_shared/cors.ts";
import { normalizeUInt160 } from "../_shared/contracts.ts";
import { getEnv, mustGetEnv } from "../_shared/env.ts";
import { error, json } from "../_shared/response.ts";
import { requireScope } from "../_shared/scopes.ts";
import { requireAuth, requirePrimaryWallet } from "../_shared/supabase.ts";
import { postJSON } from "../_shared/tee.ts";

type RNGRequest = {
  app_id: string;
};

const RNG_SCRIPT =
  "function main() { return { randomness: crypto.randomBytes(32) }; }";

// RNG is provided via NeoCompute scripts (no dedicated VRF service).
Deno.serve(async (req) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;
  if (req.method !== "POST") return error(405, "method not allowed", "METHOD_NOT_ALLOWED");

  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;
  const scopeCheck = requireScope(auth, "rng-request");
  if (scopeCheck) return scopeCheck;
  const walletCheck = await requirePrimaryWallet(auth.userId);
  if (walletCheck instanceof Response) return walletCheck;

  let body: RNGRequest;
  try {
    body = await req.json();
  } catch {
    return error(400, "invalid JSON body", "BAD_JSON");
  }
  const appId = (body.app_id ?? "").trim();
  if (!appId) return error(400, "app_id required", "APP_ID_REQUIRED");

  const requestId = crypto.randomUUID();

  const neocomputeURL = mustGetEnv("NEOCOMPUTE_URL");
  const execResult = await postJSON(
    `${neocomputeURL.replace(/\/$/, "")}/execute`,
    { script: RNG_SCRIPT, entry_point: "main" },
    { "X-User-ID": auth.userId },
  );
  if (execResult instanceof Response) return execResult;

  const output = (execResult as any)?.output ?? {};
  const randomnessHex = String(output?.randomness ?? "").trim();
  const reportHashHex = String((execResult as any)?.output_hash ?? "").trim();
  if (!/^[0-9a-fA-F]+$/.test(randomnessHex) || randomnessHex.length < 2) {
    return error(502, "invalid randomness output", "RNG_INVALID_OUTPUT");
  }

  // Optional on-chain anchoring (RandomnessLog.record) via txproxy.
  let anchoredTx: unknown = undefined;
  if (getEnv("RNG_ANCHOR") === "1") {
    const txproxyURL = mustGetEnv("TXPROXY_URL");
    const randomnessLogHash = normalizeUInt160(mustGetEnv("CONTRACT_RANDOMNESSLOG_HASH"));
    const timestamp = Math.floor(Date.now() / 1000);

    const txRes = await postJSON(
      `${txproxyURL.replace(/\/$/, "")}/invoke`,
      {
        request_id: requestId,
        contract_hash: randomnessLogHash,
        method: "record",
        params: [
          { type: "String", value: requestId },
          { type: "ByteArray", value: randomnessHex },
          { type: "ByteArray", value: reportHashHex || randomnessHex.slice(0, 64) },
          { type: "Integer", value: String(timestamp) },
        ],
        wait: true,
      },
      { "X-Service-ID": "gateway" },
    );
    if (txRes instanceof Response) return txRes;
    anchoredTx = txRes;
  }

  return json({
    request_id: requestId,
    app_id: appId,
    randomness: randomnessHex,
    report_hash: reportHashHex || undefined,
    anchored_tx: anchoredTx,
  });
});
