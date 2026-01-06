/**
 * API: Get linked OAuth accounts for a wallet
 * GET /api/oauth/accounts?wallet_address=xxx
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const walletAddress = req.query.wallet_address as string;
  if (!walletAddress) {
    return res.status(400).json({ error: "wallet_address required" });
  }

  try {
    const { data, error } = await supabase
      .from("oauth_accounts")
      .select("provider, provider_user_id, email, name, avatar, linked_at")
      .eq("wallet_address", walletAddress);

    if (error) {
      console.error("Failed to fetch OAuth accounts:", error);
      return res.status(500).json({ error: "Database error" });
    }

    const accounts = (data || []).map((row) => ({
      provider: row.provider,
      id: row.provider_user_id,
      email: row.email,
      name: row.name,
      avatar: row.avatar,
      linkedAt: row.linked_at,
    }));

    return res.json({ accounts });
  } catch (error) {
    console.error("OAuth accounts error:", error);
    return res.status(500).json({ error: "Failed to fetch accounts" });
  }
}
