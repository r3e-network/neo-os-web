import { getSession, withApiAuthRequired } from "@auth0/nextjs-auth0";
import type { NextApiRequest, NextApiResponse } from "next";
import { generateNeoAccount, encryptNeoAccount } from "@/lib/auth0/neo-account";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

export default withApiAuthRequired(async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getSession(req, res);
  if (!session?.user) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  const { password } = req.body;
  if (!password || password.length < 12) {
    return res.status(400).json({ error: "Password must be at least 12 characters" });
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

    // Generate new Neo account
    const account = generateNeoAccount();
    const encrypted = encryptNeoAccount(account, password);

    // Store encrypted key
    await supabase.from("encrypted_keys").insert({
      auth0_sub: session.user.sub,
      address: account.address,
      public_key: account.publicKey,
      encrypted_key: encrypted.encryptedPrivateKey,
    });

    res.json({ address: account.address, publicKey: account.publicKey });
  } catch (error) {
    console.error("Failed to create Neo account:", error);
    res.status(500).json({ error: "Failed to create account" });
  }
});
