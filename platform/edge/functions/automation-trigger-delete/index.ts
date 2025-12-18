import { handleCorsPreflight } from "../_shared/cors.ts";
import { mustGetEnv } from "../_shared/env.ts";
import { error, json } from "../_shared/response.ts";
import { requireScope } from "../_shared/scopes.ts";
import { requireAuth, requirePrimaryWallet } from "../_shared/supabase.ts";
import { requestJSON } from "../_shared/tee.ts";

type DeleteTriggerRequest = {
  id: string;
};

// Thin gateway to the NeoFlow service (DELETE /triggers/{id}).
// Uses POST in Edge for portability.
Deno.serve(async (req) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;
  if (req.method !== "POST") return error(405, "method not allowed", "METHOD_NOT_ALLOWED");

  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;
  const scopeCheck = requireScope(auth, "automation-trigger-delete");
  if (scopeCheck) return scopeCheck;
  const walletCheck = await requirePrimaryWallet(auth.userId);
  if (walletCheck instanceof Response) return walletCheck;

  let body: DeleteTriggerRequest;
  try {
    body = await req.json();
  } catch {
    return error(400, "invalid JSON body", "BAD_JSON");
  }

  const triggerId = String((body as any)?.id ?? "").trim();
  if (!triggerId) return error(400, "id required", "ID_REQUIRED");

  const neoflowURL = mustGetEnv("NEOFLOW_URL").replace(/\/$/, "");
  const result = await requestJSON(`${neoflowURL}/triggers/${encodeURIComponent(triggerId)}`, {
    method: "DELETE",
    headers: { "X-User-ID": auth.userId },
  });
  if (result instanceof Response) return result;
  return json({ status: "ok" });
});

