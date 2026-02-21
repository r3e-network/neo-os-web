import type { NextApiRequest, NextApiResponse } from "next";
import { getPreferences, upsertPreferences } from "@/lib/notifications/supabase-service";
import { apiError } from "@/lib/api-response";
import { withCsrfProtection } from "@/lib/csrf";
import { logger } from "@/lib/logger";
import { standardLimit } from "@/lib/rate-limit";
import { requireWalletAuth } from "@/lib/require-wallet-auth";

const DEFAULT_PREFERENCES = {
  email: null,
  emailVerified: false,
  notifyMiniappResults: true,
  notifyBalanceChanges: true,
  notifyChainAlerts: false,
  digestFrequency: "instant" as const,
};

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (standardLimit(req, res)) return;
  res.setHeader("Cache-Control", "no-store, private");
  try {
    if (req.method === "GET") {
      const { wallet } = req.query;
      if (!wallet || typeof wallet !== "string" || !/^N[A-Za-z0-9]{33}$/.test(wallet)) {
        return apiError.badRequest(res, "Invalid wallet address");
      }

      const authedWallet = await requireWalletAuth(req, res);
      if (!authedWallet) return;
      if (wallet !== authedWallet) {
        return apiError.forbidden(res, "Wallet mismatch");
      }

      const prefs = await getPreferences(wallet);

      return res.status(200).json({
        preferences: prefs ?? { walletAddress: wallet, ...DEFAULT_PREFERENCES },
      });
    }

    if (req.method === "POST") {
      const prefs = req.body;
      if (!prefs?.walletAddress || typeof prefs.walletAddress !== "string") {
        return apiError.badRequest(res, "Invalid wallet address");
      }
      if (!/^N[A-Za-z0-9]{33}$/.test(prefs.walletAddress)) {
        return apiError.badRequest(res, "Invalid wallet address format");
      }
      if (prefs.email !== undefined && prefs.email !== null) {
        if (typeof prefs.email !== "string" || prefs.email.length > 255) {
          return apiError.badRequest(res, "Invalid email");
        }
      }
      const validFrequencies = ["instant", "daily", "weekly"];
      if (prefs.digestFrequency && !validFrequencies.includes(prefs.digestFrequency)) {
        return apiError.badRequest(res, "Invalid digest frequency");
      }

      const authedWallet = await requireWalletAuth(req, res);
      if (!authedWallet) return;
      if (prefs.walletAddress !== authedWallet) {
        return apiError.forbidden(res, "Wallet mismatch");
      }

      const success = await upsertPreferences(prefs);
      if (!success) {
        return apiError.internal(res, "Failed to save preferences");
      }

      return res.status(200).json({ success: true });
    }

    return apiError.methodNotAllowed(res);
  } catch (err) {
    logger.error("Preferences error:", err instanceof Error ? err.message : "unknown error");
    return apiError.internal(res, "Failed to process preferences");
  }
}

export default withCsrfProtection(handler);
