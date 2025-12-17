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

export async function requireUser(req: Request): Promise<{ userId: string } | Response> {
  const token = parseBearerToken(req);
  if (!token) return error(401, "missing Authorization: Bearer <jwt>", "AUTH_REQUIRED");

  const supabase = supabaseClient();
  const { data, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !data?.user?.id) return error(401, "invalid session", "AUTH_INVALID");

  return { userId: data.user.id };
}

