/**
 * API: Create Neo account for OAuth user
 * POST /api/account/create
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { generateNeoAccount, encryptNeoAccount } from "@/lib/auth0/neo-account";
import { validatePassword } from "@/lib/auth0/crypto";
import { supabase } from "@/lib/supabase";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { password, oauthProvider, oauthUserId } = req.body;

    // Validate password
    const validation = validatePassword(password);
    if (!validation.valid) {
      return res.status(400).json({ error: "Weak password", details: validation.errors });
    }

    // Generate new Neo account
    const account = generateNeoAccount();

    // Encrypt private key
    const encrypted = encryptNeoAccount(account, password);

    // Store encrypted key in database
    const { error: dbError } = await supabase.from("encrypted_keys").insert({
      wallet_address: account.address,
      encrypted_private_key: encrypted.encryptedPrivateKey,
      encryption_salt: encrypted.salt,
      key_derivation_params: {
        iv: encrypted.iv,
        tag: encrypted.tag,
        iterations: encrypted.iterations,
      },
    });

    if (dbError) {
      console.error("Failed to store encrypted key:", dbError);
      return res.status(500).json({ error: "Failed to create account" });
    }

    // Link OAuth account if provided
    if (oauthProvider && oauthUserId) {
      await supabase.from("oauth_accounts").update({ wallet_address: account.address }).match({
        provider: oauthProvider,
        provider_user_id: oauthUserId,
      });
    }

    return res.status(200).json({
      address: account.address,
      publicKey: account.publicKey,
    });
  } catch (error) {
    console.error("Account creation error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
