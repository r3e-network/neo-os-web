import type { NextApiRequest, NextApiResponse } from "next";
import { getPreferences, upsertPreferences } from "@/lib/notifications/supabase-service";

const DEFAULT_PREFERENCES = {
  email: null,
  emailVerified: false,
  notifyMiniappResults: true,
  notifyBalanceChanges: true,
  notifyChainAlerts: false,
  digestFrequency: "instant" as const,
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "GET") {
    const { wallet } = req.query;
    if (!wallet || typeof wallet !== "string") {
      return res.status(400).json({ error: "Wallet address required" });
    }

    const prefs = await getPreferences(wallet);

    return res.status(200).json({
      preferences: prefs ?? { walletAddress: wallet, ...DEFAULT_PREFERENCES },
    });
  }

  if (req.method === "POST") {
    const prefs = req.body;
    if (!prefs?.walletAddress) {
      return res.status(400).json({ error: "Invalid preferences" });
    }

    const success = await upsertPreferences(prefs);
    if (!success) {
      return res.status(500).json({ error: "Failed to save preferences" });
    }

    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
