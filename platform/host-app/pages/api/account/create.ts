/**
 * API: Create NeoHub account for OAuth user
 * POST /api/account/create
 *
 * Creates a new NeoHub account with initial social identity,
 * generates a Neo wallet, and links it to the account.
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { getSession } from "@auth0/nextjs-auth0";
import { generateNeoAccount, encryptNeoAccount } from "@/lib/auth0/neo-account";
import { validatePassword } from "@/lib/auth0/crypto";
import { createNeoHubAccount, linkNeoAccount, getNeoHubAccountByAuth0Sub } from "@/lib/neohub-account";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Get Auth0 session
    const session = await getSession(req, res);
    if (!session?.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const auth0Sub = session.user.sub;
    const { password } = req.body;

    // Validate password
    const validation = validatePassword(password);
    if (!validation.valid) {
      return res.status(400).json({ error: "Weak password", details: validation.errors });
    }

    // Check if user already has an account
    const existing = await getNeoHubAccountByAuth0Sub(auth0Sub);
    if (existing) {
      const primaryNeo = existing.linkedNeoAccounts.find((n) => n.isPrimary);
      return res.status(400).json({
        error: "Account already exists",
        address: primaryNeo?.address,
      });
    }

    // Extract provider from auth0_sub
    const provider = auth0Sub.split("|")[0] || "unknown";

    // Create NeoHub account with initial social identity
    const neohubAccount = await createNeoHubAccount({
      password,
      auth0Sub,
      provider,
      email: session.user.email,
      name: session.user.name,
      avatar: session.user.picture,
    });

    // Generate new Neo account
    const neoAccount = generateNeoAccount();

    // Encrypt private key
    const encrypted = encryptNeoAccount(neoAccount, password);

    // Link Neo account to NeoHub account
    await linkNeoAccount({
      neohubAccountId: neohubAccount.id,
      address: neoAccount.address,
      publicKey: neoAccount.publicKey,
      encryptedPrivateKey: encrypted.encryptedPrivateKey,
      salt: encrypted.salt,
      iv: encrypted.iv,
      tag: encrypted.tag,
      iterations: encrypted.iterations,
    });

    return res.status(200).json({
      neohubAccountId: neohubAccount.id,
      address: neoAccount.address,
      publicKey: neoAccount.publicKey,
    });
  } catch (error) {
    console.error("Account creation error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
