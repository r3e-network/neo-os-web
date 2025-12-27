import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getEnv, mustGetEnv } from "./env.ts";
import { error } from "./response.ts";

function parseBearerToken(req: Request): string | undefined {
  const auth = req.headers.get("Authorization")?.trim() ?? "";
  if (!auth.toLowerCase().startsWith("bearer ")) return undefined;
  const token = auth.slice("bearer ".length).trim();
  return token ? token : undefined;
}

function parseUserAPIKey(req: Request): string | undefined {
  const raw = req.headers.get("X-API-Key")?.trim() ?? "";
  return raw ? raw : undefined;
}

export function supabaseClient() {
  const url = mustGetEnv("SUPABASE_URL");
  const anonKey = mustGetEnv("SUPABASE_ANON_KEY");
  return createClient(url, anonKey, { auth: { persistSession: false } });
}

export function supabaseServiceClient() {
  const url = mustGetEnv("SUPABASE_URL");
  const serviceKey = getEnv("SUPABASE_SERVICE_ROLE_KEY") ?? getEnv("SUPABASE_SERVICE_KEY");
  if (!serviceKey) {
    throw new Error("missing required env var: SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SERVICE_KEY)");
  }
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

export type AuthContext = {
  userId: string;
  email?: string;
  token?: string;
  apiKeyId?: string;
  scopes?: string[];
  authType: "bearer" | "api_key";
};

export async function requireUser(req: Request): Promise<AuthContext | Response> {
  const token = parseBearerToken(req);
  if (!token) return error(401, "missing Authorization: Bearer <jwt>", "AUTH_REQUIRED", req);

  const supabase = supabaseClient();
  const { data, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !data?.user?.id) return error(401, "invalid session", "AUTH_INVALID", req);

  return {
    userId: data.user.id,
    email: data.user.email ?? undefined,
    token,
    authType: "bearer",
  };
}

export async function requireAuth(req: Request): Promise<AuthContext | Response> {
  const bearer = await requireUser(req);
  if (!(bearer instanceof Response)) return bearer;

  const apiKey = parseUserAPIKey(req);
  if (!apiKey) return error(401, "missing Authorization or X-API-Key", "AUTH_REQUIRED", req);

  const supabase = supabaseServiceClient();
  const { data, error: verifyErr } = await supabase.rpc("verify_api_key", { input_key: apiKey });
  if (verifyErr) return error(500, `failed to verify api key: ${verifyErr.message}`, "DB_ERROR", req);

  const row = Array.isArray(data) ? data[0] : data;
  const valid = Boolean(row?.valid);
  if (!valid) return error(401, "invalid api key", "AUTH_INVALID", req);

  const userId = String(row?.user_id ?? "").trim();
  if (!userId) return error(401, "invalid api key", "AUTH_INVALID", req);

  const scopes = Array.isArray(row?.scopes) ? (row?.scopes as string[]) : undefined;
  const apiKeyId = String(row?.key_id ?? "").trim() || undefined;

  return { userId, apiKeyId, scopes, authType: "api_key" };
}

export async function requirePrimaryWallet(userId: string, req?: Request): Promise<{ address: string } | Response> {
  const supabase = supabaseServiceClient();
  const { data, error: walletsErr } = await supabase
    .from("user_wallets")
    .select("address,is_primary,verified")
    .eq("user_id", userId)
    .eq("is_primary", true)
    .eq("verified", true)
    .limit(1);

  if (walletsErr) return error(500, `failed to validate wallet binding: ${walletsErr.message}`, "DB_ERROR", req);
  if (!data || data.length === 0) return error(428, "primary wallet binding required", "WALLET_REQUIRED", req);

  const address = String(data[0]?.address ?? "").trim();
  if (!address) return error(428, "primary wallet binding required", "WALLET_REQUIRED", req);
  return { address };
}

export async function ensureUserRow(
  auth: AuthContext,
  patch: Record<string, unknown> = {},
  req?: Request,
): Promise<{ id: string; nonce?: string; address?: string } | Response> {
  const row: Record<string, unknown> = { id: auth.userId, ...patch };
  if (auth.email) row.email = auth.email;

  const supabase = supabaseServiceClient();
  const { data, error: upsertErr } = await supabase
    .from("users")
    .upsert(row, { onConflict: "id" })
    .select("id,nonce,address")
    .maybeSingle();

  if (upsertErr) return error(500, `failed to ensure user: ${upsertErr.message}`, "DB_ERROR", req);
  return data ?? { id: auth.userId };
}
