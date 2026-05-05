import type { NextApiRequest, NextApiResponse } from "next";
import { apiError } from "@/lib/api-response";
import { requireWalletAuth } from "@/lib/require-wallet-auth";
import { getServerSupabaseClient } from "@/lib/server-supabase";
import { resolveUserIdFromWallet } from "@/lib/wallet-user";
import { standardLimit } from "@/lib/rate-limit";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (standardLimit(req, res)) return;
  if (req.method !== "DELETE") return apiError.methodNotAllowed(res);

  const wallet = await requireWalletAuth(req, res);
  if (!wallet) return;

  const supabase = getServerSupabaseClient({ requireServiceRole: true });
  if (!supabase) return apiError.configError(res, "Supabase not configured");

  const userId = await resolveUserIdFromWallet(supabase, wallet, { createIfMissing: true });
  if (!userId) return apiError.unauthorized(res, "unable to resolve wallet owner");

  const id = String(req.query.id || "").trim();
  if (!id) return apiError.badRequest(res, "token id required");

  const { error } = await supabase
    .from("user_encrypted_tokens")
    .update({ status: "revoked", updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", userId);

  if (error) return apiError.internal(res, "failed to revoke token");
  return res.status(200).json({ status: "ok" });
}
