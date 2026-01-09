/**
 * Update Account API - Change password or import new WIF
 * PUT /api/account/update
 */
import { getSession, withApiAuthRequired } from "@auth0/nextjs-auth0";
import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

export default withApiAuthRequired(async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "PUT") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const session = await getSession(req, res);
    if (!session?.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const { encrypted, address, publicKey } = req.body;

    if (!encrypted || !address || !publicKey) {
      return res.status(400).json({
        error: "Missing required fields",
      });
    }

    const { encryptedData, salt, iv, tag, iterations } = encrypted;
    if (!encryptedData || !salt || !iv || !tag || !iterations) {
      return res.status(400).json({
        error: "Invalid encrypted data",
      });
    }

    // Update existing account
    const { error: updateError } = await supabase
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

    if (updateError) {
      console.error("Update error:", updateError);
      return res.status(500).json({ error: "Failed to update" });
    }

    return res.json({
      success: true,
      address,
      publicKey,
    });
  } catch (error) {
    console.error("Account update error:", error);
    return res.status(500).json({ error: "Internal error" });
  }
});
