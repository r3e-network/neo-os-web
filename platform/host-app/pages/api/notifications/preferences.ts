import type { NextApiRequest, NextApiResponse } from "next";
import { getPreferences, upsertPreferences } from "@/lib/notifications/supabase-service";
import { apiError } from "@/lib/api-response";
import { withCsrfProtection } from "@/lib/csrf";

const DEFAULT_PREFERENCES = {
  email: null,
  emailVerified: false,
  notifyMiniappResults: true,
  notifyBalanceChanges: true,
  notifyChainAlerts: false,
  digestFrequency: "instant" as const,
};

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "GET") {
    const { wallet } = req.query;
    if (!wallet || typeof wallet !== "string") {
      return apiError.badRequest(res, "Wallet address required");
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
    if (prefs.email !== undefined && prefs.email !== null && typeof prefs.email !== "string") {
      return apiError.badRequest(res, "Invalid email");
    }
    const validFrequencies = ["instant", "daily", "weekly"];
    if (prefs.digestFrequency && !validFrequencies.includes(prefs.digestFrequency)) {
      return apiError.badRequest(res, "Invalid digest frequency");
    }

    const success = await upsertPreferences(prefs);
    if (!success) {
      return apiError.internal(res, "Failed to save preferences");
    }

    return res.status(200).json({ success: true });
  }

  return apiError.methodNotAllowed(res);
}

export default withCsrfProtection(handler);
