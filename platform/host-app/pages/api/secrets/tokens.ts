import type { NextApiRequest, NextApiResponse } from "next";
import { apiError } from "@/lib/api-response";
import { requireWalletAuth } from "@/lib/require-wallet-auth";
import { getServerSupabaseClient } from "@/lib/server-supabase";
import { resolveUserIdFromWallet } from "@/lib/wallet-user";
import { standardLimit } from "@/lib/rate-limit";
import { canonicalizeMiniAppId } from "@/lib/miniapp-id";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (standardLimit(req, res)) return;

  const wallet = await requireWalletAuth(req, res);
  if (!wallet) return;

  const supabase = getServerSupabaseClient({ requireServiceRole: true });
  if (!supabase) return apiError.configError(res, "Supabase not configured");

  const userId = await resolveUserIdFromWallet(supabase, wallet, { createIfMissing: true });
  if (!userId) return apiError.unauthorized(res, "unable to resolve wallet owner");

  if (req.method === "GET") {
    const appId = canonicalizeMiniAppId(String(req.query.appId || "").trim()) || String(req.query.appId || "").trim();
    let query = supabase
      .from("user_encrypted_tokens")
      .select("id,token_name,app_id,secret_type,status,created_at,last_used_at,expires_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (appId) query = query.eq("app_id", appId);

    const { data, error } = await query;
    if (error) return apiError.internal(res, "failed to list encrypted tokens");

    const tokens = (data || []).map((row: any) => ({
      id: row.id,
      name: row.token_name,
      appId: row.app_id,
      appName: row.app_id,
      secretType: row.secret_type,
      status: row.status,
      createdAt: row.created_at,
      lastUsed: row.last_used_at || undefined,
      expiresAt: row.expires_at || null,
    }));

    return res.status(200).json({ tokens });
  }

  if (req.method === "POST") {
    const { name, appId, secretType, encryptedToken, targetOrigin, headerName } = req.body || {};
    const tokenName = String(name || "").trim();
    const scopedAppId = canonicalizeMiniAppId(String(appId || "global").trim()) || "global";
    const secretKind = String(secretType || "api_key").trim() || "api_key";
    const ciphertext = String(encryptedToken || "").trim();
    const origin = String(targetOrigin || "").trim() || null;
    const header = String(headerName || "Authorization").trim() || "Authorization";

    if (!tokenName || !ciphertext) {
      return apiError.badRequest(res, "name and encryptedToken are required");
    }

    const { data, error } = await supabase
      .from("user_encrypted_tokens")
      .upsert({
        user_id: userId,
        app_id: scopedAppId,
        token_name: tokenName,
        secret_type: secretKind,
        target_origin: origin,
        header_name: header,
        encrypted_token: ciphertext,
        key_algorithm: "RSA-OAEP-SHA256",
        status: "active",
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id,token_name" })
      .select("id,token_name,app_id,secret_type,status,created_at,last_used_at,expires_at")
      .single();

    if (error || !data) return apiError.internal(res, "failed to store encrypted token");

    return res.status(200).json({
      token: {
        id: data.id,
        name: data.token_name,
        appId: data.app_id,
        appName: data.app_id,
        secretType: data.secret_type,
        status: data.status,
        createdAt: data.created_at,
        lastUsed: data.last_used_at || undefined,
        expiresAt: data.expires_at || null,
      },
    });
  }

  return apiError.methodNotAllowed(res);
}
