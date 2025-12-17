import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { mustGetEnv } from "./env.ts";
import { error } from "./response.ts";

function parseBearerToken(req: Request): string | undefined {
  const auth = req.headers.get("Authorization")?.trim() ?? "";
  if (!auth.toLowerCase().startsWith("bearer ")) return undefined;
  const token = auth.slice("bearer ".length).trim();
  return token ? token : undefined;
}

export function supabaseClient() {
  const url = mustGetEnv("SUPABASE_URL");
  const anonKey = mustGetEnv("SUPABASE_ANON_KEY");
  return createClient(url, anonKey, { auth: { persistSession: false } });
}

export function supabaseServiceClient() {
  const url = mustGetEnv("SUPABASE_URL");
  const serviceKey = mustGetEnv("SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

export type AuthContext = {
  userId: string;
  email?: string;
  token: string;
};

export async function requireUser(req: Request): Promise<AuthContext | Response> {
  const token = parseBearerToken(req);
  if (!token) return error(401, "missing Authorization: Bearer <jwt>", "AUTH_REQUIRED");

  const supabase = supabaseClient();
  const { data, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !data?.user?.id) return error(401, "invalid session", "AUTH_INVALID");

  return { userId: data.user.id, email: data.user.email ?? undefined, token };
}

export async function requirePrimaryWallet(userId: string): Promise<{ address: string } | Response> {
  const supabase = supabaseServiceClient();
  const { data, error: walletsErr } = await supabase
    .from("user_wallets")
    .select("address,is_primary,verified")
    .eq("user_id", userId)
    .eq("is_primary", true)
    .eq("verified", true)
    .limit(1);

  if (walletsErr) return error(500, `failed to validate wallet binding: ${walletsErr.message}`, "DB_ERROR");
  if (!data || data.length === 0) return error(428, "primary wallet binding required", "WALLET_REQUIRED");

  const address = String((data[0] as any)?.address ?? "").trim();
  if (!address) return error(428, "primary wallet binding required", "WALLET_REQUIRED");
  return { address };
}
