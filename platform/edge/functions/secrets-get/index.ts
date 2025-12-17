import { handleCorsPreflight } from "../_shared/cors.ts";
import { error, json } from "../_shared/response.ts";
import { decryptSecretValue } from "../_shared/secrets.ts";
import { ensureUserRow, requireAuth, requirePrimaryWallet, supabaseServiceClient } from "../_shared/supabase.ts";

// Returns the decrypted secret value for the authenticated user.
Deno.serve(async (req) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;
  if (req.method !== "GET") return error(405, "method not allowed", "METHOD_NOT_ALLOWED");

  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;
  const walletCheck = await requirePrimaryWallet(auth.userId);
  if (walletCheck instanceof Response) return walletCheck;

  const ensured = await ensureUserRow(auth);
  if (ensured instanceof Response) return ensured;

  const url = new URL(req.url);
  const name = (url.searchParams.get("name") ?? "").trim();
  if (!name) return error(400, "name required", "NAME_REQUIRED");

  const supabase = supabaseServiceClient();
  const { data, error: getErr } = await supabase
    .from("secrets")
    .select("name,encrypted_value,version")
    .eq("user_id", auth.userId)
    .eq("name", name)
    .limit(1);

  if (getErr) return error(500, `failed to load secret: ${getErr.message}`, "DB_ERROR");
  if (!data || data.length === 0) return error(404, "secret not found", "NOT_FOUND");

  const encryptedBase64 = String((data[0] as any)?.encrypted_value ?? "").trim();
  if (!encryptedBase64) return error(500, "secret stored without ciphertext", "DB_ERROR");

  let value: string;
  try {
    value = await decryptSecretValue(encryptedBase64);
  } catch (e) {
    return error(500, `failed to decrypt secret: ${(e as Error).message}`, "DECRYPT_FAILED");
  }

  return json({
    name: String((data[0] as any)?.name ?? name),
    value,
    version: (data[0] as any)?.version ?? 0,
  });
});
