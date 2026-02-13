// Initialize environment validation at startup (fail-fast)
import "../_shared/init.ts";
import "../_shared/deno.d.ts";

import { createHandler } from "../_shared/handler.ts";
import { json } from "../_shared/response.ts";
import { errorResponse, validationError, notFoundError } from "../_shared/error-codes.ts";
import { supabaseServiceClient } from "../_shared/supabase.ts";

type DeleteSecretRequest = {
  name: string;
};

// Deletes a secret and its permissions for the authenticated user.
export const handler = createHandler(
  {
    method: "DELETE",
    auth: "user",
    rateLimit: "secrets-delete",
    hostScope: "secrets-delete",
    requireWallet: true,
    ensureUser: true,
  },
  async ({ req, auth }) => {
    let body: DeleteSecretRequest;
    try {
      body = await req.json();
    } catch {
      return errorResponse("BAD_JSON", undefined, req);
    }

    const name = String(body.name ?? "").trim();
    if (!name) return validationError("name", "name required", req);

    const supabase = supabaseServiceClient();

    // Best-effort: drop policies first.
    await supabase.from("secret_policies").delete().eq("user_id", auth.userId).eq("secret_name", name);

    const { error: delErr, count } = await supabase
      .from("secrets")
      .delete({ count: "exact" })
      .eq("user_id", auth.userId)
      .eq("name", name);

    if (delErr) return errorResponse("SERVER_002", { message: `failed to delete secret: ${delErr.message}` }, req);
    if (!count) return notFoundError("secret", req);

    return json({ status: "ok" }, {}, req);
  }
);

if (import.meta.main) {
  Deno.serve(handler);
}
