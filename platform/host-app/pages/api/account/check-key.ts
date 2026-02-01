/**
 * API: Check if account has encrypted key
 * GET /api/account/check-key?address=xxx
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/lib/supabase";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { address } = req.query;

    if (!address || typeof address !== "string") {
      return res.status(400).json({ error: "Missing address" });
    }

    const { data, error } = await supabase
      .from("encrypted_keys")
      .select("wallet_address")
      .eq("wallet_address", address)
      .single();

    return res.status(200).json({ hasKey: !error && !!data });
  } catch (error) {
    console.error("Key check error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
