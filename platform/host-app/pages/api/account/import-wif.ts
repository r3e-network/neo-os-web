/**
 * Import WIF API - Import external Neo account via WIF
 * POST /api/account/import-wif
 */
import { getSession, withApiAuthRequired } from "@auth0/nextjs-auth0";
import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { wallet } from "@cityofzion/neon-js";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export default withApiAuthRequired(async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const session = await getSession(req, res);
    if (!session?.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const { wif, encrypted } = req.body;

    // Validate WIF format
    if (!wif || typeof wif !== "string") {
      return res.status(400).json({ error: "WIF required" });
    }

    // Validate encrypted data
    if (!encrypted) {
      return res.status(400).json({ error: "Encrypted data required" });
    }

    const { encryptedData, salt, iv, tag, iterations } = encrypted;
    if (!encryptedData || !salt || !iv || !tag || !iterations) {
      return res.status(400).json({ error: "Invalid encrypted data" });
    }

    // Derive address and public key from WIF
    let account;
    try {
      account = new wallet.Account(wif);
    } catch {
      return res.status(400).json({ error: "Invalid WIF format" });
    }

    const address = account.address;
    const publicKey = account.publicKey;

    // Check if user already has an account
    const { data: existing } = await supabase
      .from("encrypted_keys")
      .select("id")
      .eq("auth0_sub", session.user.sub)
      .single();

    if (existing) {
      // Update existing
      const { error } = await supabase
        .from("encrypted_keys")
        .update({
          address,
          public_key: publicKey,
          encrypted_key: encryptedData,
          salt,
          iv,
          tag,
          iterations,
          updated_at: new Date().toISOString(),
        })
        .eq("auth0_sub", session.user.sub);

      if (error) {
        console.error("Update error:", error);
        return res.status(500).json({ error: "Failed to update" });
      }
    } else {
      // Insert new
      const { error } = await supabase.from("encrypted_keys").insert({
        auth0_sub: session.user.sub,
        address,
        public_key: publicKey,
        encrypted_key: encryptedData,
        salt,
        iv,
        tag,
        iterations,
      });

      if (error) {
        console.error("Insert error:", error);
        return res.status(500).json({ error: "Failed to create" });
      }
    }

    return res.json({
      success: true,
      address,
      publicKey,
    });
  } catch (error) {
    console.error("Import WIF error:", error);
    return res.status(500).json({ error: "Internal error" });
  }
});
