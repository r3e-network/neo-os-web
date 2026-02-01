/**
 * API: Revoke Developer Token
 * DELETE /api/tokens/[id]
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/lib/supabase";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "DELETE") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { id } = req.query;
    const { walletAddress } = req.body;

    if (!id || !walletAddress) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const { error } = await supabase
      .from("developer_tokens")
      .update({ revoked_at: new Date().toISOString() })
      .match({ id: Number(id), wallet_address: walletAddress });

    if (error) {
      console.error("Failed to revoke token:", error);
      return res.status(500).json({ error: "Failed to revoke token" });
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Token revocation error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
