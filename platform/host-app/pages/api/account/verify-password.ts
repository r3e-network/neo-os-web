/**
 * API: Verify account password
 * POST /api/account/verify-password
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { verifyAccountPassword } from "@/lib/auth0/neo-account";
import { supabase } from "@/lib/supabase";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { walletAddress, password } = req.body;

    if (!walletAddress || !password) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Get encrypted key from database
    const { data, error } = await supabase
      .from("encrypted_keys")
      .select("*")
      .eq("wallet_address", walletAddress)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: "Account not found" });
    }

    // Verify password
    const isValid = verifyAccountPassword(
      {
        address: data.wallet_address,
        publicKey: "",
        encryptedPrivateKey: data.encrypted_private_key,
        salt: data.encryption_salt,
        iv: data.key_derivation_params.iv,
        tag: data.key_derivation_params.tag,
        iterations: data.key_derivation_params.iterations,
      },
      password,
    );

    return res.status(200).json({ valid: isValid });
  } catch (error) {
    console.error("Password verification error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
