/**
 * Neo Account API - Client-side encryption model
 * POST: Store pre-encrypted account (encryption happens in browser)
 * GET: Retrieve encrypted account data
 */
import { getSession, withApiAuthRequired } from "@auth0/nextjs-auth0";
import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

export default withApiAuthRequired(async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "GET") {
    try {
      const session = await getSession(req, res);
      if (!session?.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const { data: existing } = await supabase
        .from("encrypted_keys")
        .select("address, public_key, encrypted_private_key, encryption_salt, key_derivation_params")
        .eq("auth0_sub", session.user.sub)
        .single();

      if (!existing) {
        return res.status(404).json({ error: "No Neo account found" });
      }

      const params = existing.key_derivation_params || {};
      return res.json({
        address: existing.address,
        publicKey: existing.public_key,
        encryptedKey: {
          encryptedData: existing.encrypted_private_key,
          salt: existing.encryption_salt,
          iv: params.iv,
          tag: params.tag,
          iterations: params.iterations,
        },
      });
    } catch (error) {
      console.error("Failed to fetch Neo account:", error);
      return res.status(500).json({ error: "Failed to fetch account" });
    }
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getSession(req, res);
  if (!session?.user) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  // Client-side encryption model: receive pre-encrypted data
  const { address, publicKey, encrypted } = req.body;

  // Validate required fields
  if (!address || !publicKey || !encrypted) {
    return res.status(400).json({ error: "Missing required fields: address, publicKey, encrypted" });
  }

  // Validate encrypted object structure
  const { encryptedData, salt, iv, tag, iterations } = encrypted;
  if (!encryptedData || !salt || !iv || !tag || !iterations) {
    return res.status(400).json({ error: "Invalid encrypted data structure" });
  }

  try {
    // Check if user already has a Neo account
    const { data: existing } = await supabase
      .from("encrypted_keys")
      .select("address")
      .eq("auth0_sub", session.user.sub)
      .single();

    if (existing) {
      return res.status(400).json({ error: "Neo account already exists" });
    }

    // Store pre-encrypted key (encryption happened in browser)
    const { error: insertError } = await supabase.from("encrypted_keys").insert({
      auth0_sub: session.user.sub,
      wallet_address: address,
      address: address,
      public_key: publicKey,
      encrypted_private_key: encryptedData,
      encryption_salt: salt,
      key_derivation_params: { iv, tag, iterations },
    });

    if (insertError) {
      console.error("Failed to store encrypted key:", insertError);
      return res.status(500).json({ error: "Failed to store account" });
    }

    res.json({ address, publicKey });
  } catch (error) {
    console.error("Failed to create Neo account:", error);
    res.status(500).json({ error: "Failed to create account" });
  }
});
