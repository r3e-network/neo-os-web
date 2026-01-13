/**
 * API: Change NeoHub account password
 * POST /api/account/change-password
 *
 * Changes both the NeoHub account password and re-encrypts all linked Neo private keys.
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { getSession } from "@auth0/nextjs-auth0";
import { decryptNeoAccount, encryptNeoAccount } from "@/lib/auth0/neo-account";
import { validatePassword } from "@/lib/auth0/crypto";
import { supabase } from "@/lib/supabase";
import { getNeoHubAccountByAuth0Sub, changePassword, getEncryptedKey } from "@/lib/neohub-account";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const session = await getSession(req, res);
    if (!session?.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Validate new password
    const validation = validatePassword(newPassword);
    if (!validation.valid) {
      return res.status(400).json({ error: "Weak password", details: validation.errors });
    }

    // Get NeoHub account
    const account = await getNeoHubAccountByAuth0Sub(session.user.sub);
    if (!account) {
      return res.status(404).json({ error: "NeoHub account not found" });
    }

    // Change NeoHub account password
    const result = await changePassword(account.id, currentPassword, newPassword);
    if (!result.success) {
      return res.status(401).json({ error: result.error });
    }

    // Re-encrypt all linked Neo private keys
    // First, prepare all re-encrypted keys before updating database
    const reEncryptedKeys: Array<{
      address: string;
      encrypted: ReturnType<typeof encryptNeoAccount>;
    }> = [];

    const failedAddresses: string[] = [];

    for (const neoAccount of account.linkedNeoAccounts) {
      const encryptedKey = await getEncryptedKey(neoAccount.address);
      if (!encryptedKey) continue;

      try {
        // Decrypt with current password
        const decrypted = decryptNeoAccount(
          {
            address: encryptedKey.wallet_address,
            publicKey: encryptedKey.public_key || "",
            encryptedPrivateKey: encryptedKey.encrypted_private_key,
            salt: encryptedKey.encryption_salt,
            iv: encryptedKey.key_derivation_params?.iv,
            tag: encryptedKey.key_derivation_params?.tag,
            iterations: encryptedKey.key_derivation_params?.iterations,
          },
          currentPassword,
        );

        // Re-encrypt with new password
        const encrypted = encryptNeoAccount(decrypted, newPassword);
        reEncryptedKeys.push({ address: neoAccount.address, encrypted });
      } catch (err) {
        console.error(`Failed to re-encrypt key for ${neoAccount.address}:`, err);
        failedAddresses.push(neoAccount.address);
      }
    }

    // If any key failed to re-encrypt, abort the entire operation
    if (failedAddresses.length > 0) {
      // Note: Password was already changed, but we should warn the user
      console.error(`Password changed but ${failedAddresses.length} keys failed to re-encrypt`);
      return res.status(500).json({
        error: "Partial failure",
        message: `Password changed but some keys failed to re-encrypt: ${failedAddresses.join(", ")}`,
        failedAddresses,
      });
    }

    // Update all keys in database
    for (const { address, encrypted } of reEncryptedKeys) {
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
        .eq("wallet_address", address);

      if (updateError) {
        console.error(`Failed to update encrypted key for ${address}:`, updateError);
      }
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Password change error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
