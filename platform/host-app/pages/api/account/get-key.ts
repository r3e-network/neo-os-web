/**
 * API: Get decrypted private key for signing
 * POST /api/account/get-key
 * SECURITY: Requires Auth0 session and validates user owns the wallet
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
    // SECURITY: Validate Auth0 session
    const session = await getSession(req, res);
    if (!session?.user) {
      return res.status(401).json({ error: "Unauthorized - Auth0 session required" });
    }

    const auth0Sub = session.user.sub;
    const { walletAddress, password } = req.body;

    if (!walletAddress || !password) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // SECURITY: Verify user owns this wallet via neo_accounts table
    const { data: neoAccount, error: neoError } = await supabase
      .from("neo_accounts")
      .select("address")
      .eq("auth0_sub", auth0Sub)
      .eq("address", walletAddress)
      .single();

    if (neoError || !neoAccount) {
      return res.status(403).json({ error: "Forbidden - wallet not owned by user" });
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

    // Decrypt private key
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

    return res.status(200).json({
      privateKey: account.privateKey,
      address: account.address,
    });
  } catch (error) {
    console.error("Key retrieval error:", error);
    return res.status(401).json({ error: "Invalid password" });
  }
}
