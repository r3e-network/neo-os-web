/**
 * API: Change account password
 * POST /api/account/change-password
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { decryptNeoAccount, encryptNeoAccount } from "@/lib/auth0/neo-account";
import { validatePassword } from "@/lib/auth0/crypto";
import { supabase } from "@/lib/supabase";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { walletAddress, currentPassword, newPassword } = req.body;

    if (!walletAddress || !currentPassword || !newPassword) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Validate new password
    const validation = validatePassword(newPassword);
    if (!validation.valid) {
      return res.status(400).json({ error: "Weak password", details: validation.errors });
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

    // Decrypt with current password
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
      currentPassword,
    );

    // Re-encrypt with new password
    const encrypted = encryptNeoAccount(account, newPassword);

    // Update database
    const { error: updateError } = await supabase
      .from("encrypted_keys")
      .update({
        encrypted_private_key: encrypted.encryptedPrivateKey,
        encryption_salt: encrypted.salt,
        key_derivation_params: {
          iv: encrypted.iv,
          tag: encrypted.tag,
          iterations: encrypted.iterations,
        },
        updated_at: new Date().toISOString(),
      })
      .eq("wallet_address", walletAddress);

    if (updateError) {
      console.error("Failed to update password:", updateError);
      return res.status(500).json({ error: "Failed to update password" });
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Password change error:", error);
    return res.status(401).json({ error: "Invalid current password" });
  }
}
