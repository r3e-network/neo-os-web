/**
 * API: Export WIF private key
 * POST /api/account/export-wif
 * SECURITY: Requires Auth0 session and password verification
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { getSession } from "@auth0/nextjs-auth0";
import { decryptNeoAccount } from "@/lib/auth0/neo-account";
import { supabase } from "@/lib/supabase";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Validate Auth0 session
    const session = await getSession(req, res);
    if (!session?.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const auth0Sub = session.user.sub;
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ error: "Password is required" });
    }

    // Get user's Neo account
    const { data: neoAccount, error: neoError } = await supabase
      .from("neo_accounts")
      .select("address")
      .eq("auth0_sub", auth0Sub)
      .single();

    if (neoError || !neoAccount) {
      return res.status(404).json({ error: "No Neo account found" });
    }

    // Get encrypted key
    const { data, error } = await supabase
      .from("encrypted_keys")
      .select("*")
      .eq("wallet_address", neoAccount.address)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: "Encrypted key not found" });
    }

    // Decrypt and return WIF
    const account = decryptNeoAccount(
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

    // privateKey from neon-js is already in WIF format
    return res.status(200).json({ wif: account.privateKey });
  } catch (error) {
    console.error("Export WIF error:", error);
    return res.status(401).json({ error: "Invalid password" });
  }
}
