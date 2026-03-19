import type { NextApiRequest, NextApiResponse } from "next";
import { supabase, isSupabaseConfigured } from "../../../lib/supabase";
import { withCsrfProtection } from "../../../lib/csrf";
import { apiError } from "@/lib/api-response";
import { normalizeMiniAppEntryUrl } from "@/lib/miniapp-entry-url";
import { logger } from "@/lib/logger";
import { strictLimit } from "@/lib/rate-limit";
import { requireWalletAuth } from "@/lib/require-wallet-auth";

export interface SubmitMiniAppRequest {
  name: string;
  description: string;
  icon: string;
  category: "gaming" | "defi" | "social" | "nft" | "governance" | "utility";
  entry_url: string;
  contract_hash?: string;
  developer_address: string;
  developer_name?: string;
  permissions: {
    payments?: boolean;
    governance?: boolean;
    randomness?: boolean;
    datafeed?: boolean;
    aa?: boolean;
  };
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return apiError.methodNotAllowed(res);
  }
  if (strictLimit(req, res)) return;

  if (!isSupabaseConfigured) {
    return apiError.internal(res, "Database not configured");
  }

  const authedWallet = await requireWalletAuth(req, res);
  if (!authedWallet) return;

  const body = req.body as SubmitMiniAppRequest | undefined;
  if (!body || typeof body !== "object") {
    return apiError.badRequest(res, "Missing request body");
  }

  // Validate required fields
  if (!body.name || !body.description || !body.entry_url || !body.developer_address) {
    return apiError.badRequest(res, "Missing required fields");
  }

  // Length limits
  if (body.name.length > 64 || body.description.length > 2000) {
    return apiError.badRequest(res, "Name max 64 chars, description max 2000 chars");
  }
  if (body.developer_name && body.developer_name.length > 128) {
    return apiError.badRequest(res, "developer_name max 128 chars");
  }
  if (body.icon && (body.icon.length > 64 || /[<>"']|:\/\/|^(javascript|data|vbscript):/i.test(body.icon))) {
    return apiError.badRequest(res, "Invalid icon value");
  }

  // URL validation
  const normalizedEntryUrl = normalizeMiniAppEntryUrl(body.entry_url);
  if (!normalizedEntryUrl) {
    return apiError.badRequest(res, "Invalid entry_url");
  }

  // Neo N3 address format
  if (!/^N[A-Za-z0-9]{33}$/.test(body.developer_address)) {
    return apiError.badRequest(res, "Invalid developer_address format");
  }
  if (body.developer_address !== authedWallet) {
    return apiError.forbidden(res, "developer_address must match authenticated wallet");
  }

  // Contract hash format (optional)
  if (body.contract_hash && !/^0x[0-9a-fA-F]{40}$/.test(body.contract_hash)) {
    return apiError.badRequest(res, "Invalid contract_hash format");
  }

  // Category validation
  const validCategories = ["gaming", "defi", "social", "nft", "governance", "utility"];
  if (body.category && !validCategories.includes(body.category)) {
    return apiError.badRequest(res, "Invalid category");
  }

  // Generate app_id from name
  const app_id = `community-${body.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

  try {
    const { data, error } = await supabase
      .from("miniapp_submissions")
      .insert({
        app_id,
        name: body.name,
        description: body.description,
        icon: body.icon || "📦",
        category: body.category || "utility",
        entry_url: normalizedEntryUrl,
        contract_hash: body.contract_hash,
        developer_address: body.developer_address,
        developer_name: body.developer_name,
        permissions: body.permissions || {},
        source: "community",
        status: "pending",
        submitted_at: new Date().toISOString(),
      })
      .select("app_id,name,description,icon,category,entry_url,contract_hash,developer_address,developer_name,permissions,source,status,submitted_at")
      .single();

    if (error) throw error;

    res.setHeader("Cache-Control", "no-store, private");
    res.status(201).json({
      success: true,
      app_id,
      message: "MiniApp submitted for review",
      submission: data,
    });
  } catch (error) {
    logger.error("Submit error:", error instanceof Error ? error.message : "unknown error");
    return apiError.internal(res, "Failed to submit MiniApp");
  }
}

export default withCsrfProtection(handler);
