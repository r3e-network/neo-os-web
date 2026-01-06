/**
 * API: Unlink OAuth account
 * POST /api/oauth/unlink
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { provider, wallet_address } = req.body;

  if (!provider || !wallet_address) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    const { error } = await supabase
      .from("oauth_accounts")
      .delete()
      .eq("wallet_address", wallet_address)
      .eq("provider", provider);

    if (error) {
      console.error("Failed to unlink:", error);
      return res.status(500).json({ error: "Database error" });
    }

    return res.json({ success: true });
  } catch (error) {
    console.error("Unlink error:", error);
    return res.status(500).json({ error: "Failed to unlink" });
  }
}
