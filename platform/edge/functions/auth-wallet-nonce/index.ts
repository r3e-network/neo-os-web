import { handleCorsPreflight } from "../_shared/cors.ts";
import { readJsonBody } from "../_shared/request.ts";
import { error, json } from "../_shared/response.ts";
import { requireRateLimit } from "../_shared/ratelimit.ts";
import { supabaseServiceClient } from "../_shared/supabase.ts";

function stringField(row: unknown, key: string): string | undefined {
  if (!row || typeof row !== "object") return undefined;
  const value = (row as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim() ? value : undefined;
}

export async function handler(req: Request): Promise<Response> {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;
  if (req.method !== "POST") return error(405, "method not allowed", "METHOD_NOT_ALLOWED", req);

  // Audit fix H-5: rate-limit anonymous nonce issuance. Without this, an
  // attacker could rotate-overwrite any user's `users.nonce` at will (causing
  // login DoS, enumerating registered users via the `account_id` returned by
  // this endpoint, and pre-positioning nonces for chained attacks against
  // auth-wallet).
  const limited = await requireRateLimit(req, "auth-wallet-nonce");
  if (limited) return limited;

  const bodyOrErr = await readJsonBody(req);
  if (bodyOrErr instanceof Response) return bodyOrErr;
  const address = ((bodyOrErr as Record<string, unknown>)?.address as string ?? "").trim();

  if (!address) {
    return error(400, "address required", "INVALID_INPUT", req);
  }

  const isEVM = address.startsWith("0x");
  if (!isEVM && !/^N[A-HJ-NP-Za-km-z1-9]{33}$/.test(address)) {
    return error(400, "valid Neo N3 or EVM-format address required", "INVALID_INPUT", req);
  }

  const supabase = supabaseServiceClient();
  const nonce = crypto.randomUUID();
  const timestamp = Math.floor(Date.now() / 1000);
  
  const network = isEVM ? "embedded EVM" : "Neo N3";
  const message = `Sign this message to log in with your ${network} wallet.\n\nAddress: ${address}\nNonce: ${nonce}\nTimestamp: ${timestamp}`;

  // Find or create account by wallet address
  const { data: user, error: userErr } = await supabase
    .from("users")
    .select("id")
    .eq("address", address)
    .maybeSingle();

  if (userErr) {
    console.warn("[auth-wallet-nonce] user lookup failed:", userErr.message);
  }
  let accountId: string;
  const existingAccountId = stringField(user, "id");
  if (existingAccountId) {
    accountId = existingAccountId;
  } else {
    // Create new user
    const { data: newUser, error: acctErr } = await supabase
      .from("users")
      .insert({ address, wallet_type: "external" })
      .select("id")
      .single();
      
    if (acctErr || !newUser) {
      return error(500, "failed to create account", "DB_ERROR", req);
    }
    const newAccountId = stringField(newUser, "id");
    if (!newAccountId) {
      return error(500, "failed to create account", "DB_ERROR", req);
    }
    accountId = newAccountId;
  }

  // Store nonce
  const { error: nonceErr } = await supabase.from("users").upsert(
    { address, wallet_type: "external", nonce },
    { onConflict: "address" }
  );
  
  if (nonceErr) {
    return error(500, "failed to store nonce", "DB_ERROR", req);
  }

  return json({ nonce, message, account_id: accountId }, {}, req);
}

if (import.meta.main) {
  Deno.serve(handler);
}
