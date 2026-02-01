/**
 * API: Change WIF (import new Neo account)
 * POST /api/account/change-wif
 *
 * Allows user to replace their Neo account with a new WIF.
 * Requires current password verification.
 */
import { getSession, withApiAuthRequired } from "@auth0/nextjs-auth0";
import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { decryptPrivateKey } from "@/lib/auth0/crypto";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export default withApiAuthRequired(async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getSession(req, res);
  if (!session?.user) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  const { currentPassword, newAddress, newPublicKey, newEncrypted } = req.body;

  // Validate required fields
  if (!currentPassword || !newAddress || !newPublicKey || !newEncrypted) {
    return res.status(400).json({
      error: "Missing required fields",
    });
  }

  const { encryptedData, salt, iv, tag, iterations } = newEncrypted;
  if (!encryptedData || !salt || !iv || !tag || !iterations) {
    return res.status(400).json({ error: "Invalid encrypted data" });
  }

  try {
    // Get current encrypted key
    const { data: existing, error: fetchError } = await supabase
      .from("encrypted_keys")
      .select("*")
      .eq("auth0_sub", session.user.sub)
      .single();

    if (fetchError || !existing) {
      return res.status(404).json({ error: "No existing account found" });
    }

    // Verify current password by attempting decryption
    try {
      decryptPrivateKey(
        existing.encrypted_key,
        currentPassword,
        existing.salt,
        existing.iv,
        existing.tag,
        existing.iterations,
      );
    } catch {
      return res.status(401).json({ error: "Invalid current password" });
    }

    // Archive old account
    await supabase.from("archived_accounts").insert({
      auth0_sub: session.user.sub,
      old_address: existing.address,
      old_public_key: existing.public_key,
      archived_at: new Date().toISOString(),
      reason: "wif_change",
    });

    // Update with new encrypted account
    const { error: updateError } = await supabase
      .from("encrypted_keys")
      .update({
        address: newAddress,
        public_key: newPublicKey,
        encrypted_key: encryptedData,
        salt: salt,
        iv: iv,
        tag: tag,
        iterations: iterations,
        updated_at: new Date().toISOString(),
      })
      .eq("auth0_sub", session.user.sub);

    if (updateError) {
      console.error("Failed to update WIF:", updateError);
      return res.status(500).json({ error: "Failed to update account" });
    }

    return res.json({
      success: true,
      address: newAddress,
      publicKey: newPublicKey,
      previousAddress: existing.address,
    });
  } catch (error) {
    console.error("WIF change error:", error);
    return res.status(500).json({ error: "Failed to change WIF" });
  }
});
