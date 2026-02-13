// Initialize environment validation at startup (fail-fast)
import "../_shared/init.ts";
import "../_shared/deno.d.ts";

import { createHandler } from "../_shared/handler.ts";
import { json } from "../_shared/response.ts";
import { errorResponse, validationError, notFoundError } from "../_shared/error-codes.ts";
import { decryptSecretValue } from "../_shared/secrets.ts";
import { supabaseServiceClient } from "../_shared/supabase.ts";

// Returns the decrypted secret value for the authenticated user.
export const handler = createHandler(
  {
    method: "GET",
    auth: "user",
    rateLimit: "secrets-get",
    hostScope: "secrets-get",
    requireWallet: true,
    ensureUser: true,
  },
  async ({ req, auth, url }) => {
    const name = (url.searchParams.get("name") ?? "").trim();
    if (!name) return validationError("name", "name required", req);

    const supabase = supabaseServiceClient();
    const { data, error: getErr } = await supabase
      .from("secrets")
      .select("name,encrypted_value,version")
      .eq("user_id", auth.userId)
      .eq("name", name)
      .limit(1);

    if (getErr) return errorResponse("SERVER_002", { message: `failed to load secret: ${getErr.message}` }, req);
    if (!data || data.length === 0) return notFoundError("secret", req);

    const encryptedBase64 = String(data[0]?.encrypted_value ?? "").trim();
    if (!encryptedBase64) return errorResponse("SERVER_002", { message: "secret stored without ciphertext" }, req);

    let value: string;
    try {
      value = await decryptSecretValue(encryptedBase64);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      return errorResponse("SERVER_001", { message: `failed to decrypt secret: ${message}` }, req);
    }

    return json(
      {
        name: String(data[0]?.name ?? name),
        value,
        version: data[0]?.version ?? 0,
      },
      {},
      req
    );
  }
);

if (import.meta.main) {
  Deno.serve(handler);
}
