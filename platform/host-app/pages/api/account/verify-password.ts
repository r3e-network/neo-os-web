/**
 * API: Verify account password
 * POST /api/account/verify-password
 * SECURITY: Requires Auth0 session + wallet ownership verification + rate limiting
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { getSession } from "@auth0/nextjs-auth0";
import { verifyAccountPassword } from "@/lib/auth0/neo-account";
import { supabase } from "@/lib/supabase";
import { authRateLimiter } from "@/lib/security/ratelimit";

// Neo address validation regex
const NEO_ADDRESS_REGEX = /^N[A-Za-z0-9]{33}$/;

function validateWalletAddress(address: string): boolean {
  return NEO_ADDRESS_REGEX.test(address);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // SECURITY: Rate limiting - strict for password verification (10 attempts per minute)
  const ip = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "unknown";
  const { allowed } = authRateLimiter.check(ip);
  if (!allowed) {
    return res.status(429).json({ error: "Too many attempts. Please try again later." });
  }

  try {
    // SECURITY: Require Auth0 session
    const session = await getSession(req, res);
    if (!session?.user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const { walletAddress, password } = req.body;

    if (!walletAddress || !password) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // SECURITY: Validate wallet address format
    if (!validateWalletAddress(walletAddress)) {
      return res.status(400).json({ error: "Invalid wallet address format" });
    }

    // SECURITY: Verify user owns this wallet via neo_accounts table
    const { data: neoAccount, error: neoError } = await supabase
      .from("neo_accounts")
      .select("address")
      .eq("auth0_sub", session.user.sub)
      .eq("address", walletAddress)
      .single();

    if (neoError || !neoAccount) {
      return res.status(403).json({ error: "Wallet not owned by user" });
    }

    // Get encrypted key from database
    const { data, error } = await supabase
      .from("encrypted_keys")
      .select("*")
      .eq("wallet_address", walletAddress)
      .single();

    if (error || !data) {
      // SECURITY: Use generic error to prevent enumeration
      return res.status(400).json({ error: "Verification failed" });
    }

    // Verify password
    const isValid = verifyAccountPassword(
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

    return res.status(200).json({ valid: isValid });
  } catch (error) {
    console.error("Password verification error:", error);
    // SECURITY: Generic error message
    return res.status(400).json({ error: "Verification failed" });
  }
}
