/**
 * API: Reset account with new Neo account generation
 * POST /api/account/reset-with-new-account
 *
 * When user forgets password, they can generate a new Neo account.
 * Old account is archived, new encrypted account is stored.
 */
import { getSession, withApiAuthRequired } from "@auth0/nextjs-auth0";
import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export default withApiAuthRequired(async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getSession(req, res);
  if (!session?.user) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  // Receive pre-encrypted new account from browser
  const { address, publicKey, encrypted } = req.body;

  if (!address || !publicKey || !encrypted) {
    return res.status(400).json({
      error: "Missing required fields: address, publicKey, encrypted",
    });
  }

  const { encryptedData, salt, iv, tag, iterations } = encrypted;
  if (!encryptedData || !salt || !iv || !tag || !iterations) {
    return res.status(400).json({ error: "Invalid encrypted data structure" });
  }

  try {
    // Get existing account for archival
    const { data: existing } = await supabase
      .from("encrypted_keys")
      .select("address, public_key")
      .eq("auth0_sub", session.user.sub)
      .single();

    // Archive old account if exists
    if (existing) {
      await supabase.from("archived_accounts").insert({
        auth0_sub: session.user.sub,
        old_address: existing.address,
        old_public_key: existing.public_key,
        archived_at: new Date().toISOString(),
        reason: "password_reset",
      });

      // Delete old encrypted key
      await supabase.from("encrypted_keys").delete().eq("auth0_sub", session.user.sub);
    }

    // Store new encrypted account
    const { error: insertError } = await supabase.from("encrypted_keys").insert({
      auth0_sub: session.user.sub,
      address: address,
      public_key: publicKey,
      encrypted_key: encryptedData,
      salt: salt,
      iv: iv,
      tag: tag,
      iterations: iterations,
    });

    if (insertError) {
      console.error("Failed to store new account:", insertError);
      return res.status(500).json({ error: "Failed to store new account" });
    }

    return res.json({
      success: true,
      address,
      publicKey,
      previousAddress: existing?.address || null,
    });
  } catch (error) {
    console.error("Account reset error:", error);
    return res.status(500).json({ error: "Failed to reset account" });
  }
});
