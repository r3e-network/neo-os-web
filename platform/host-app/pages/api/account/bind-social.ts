/**
 * API: Bind additional social account to existing NeoHub account
 * POST /api/account/bind-social
 *
 * Allows users to bind Twitter/GitHub to their existing NeoHub account
 * so they can login with any linked social account.
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { getSession } from "@auth0/nextjs-auth0";
import { getNeoHubAccountByAuth0Sub, linkIdentity, verifyAccountPassword } from "@/lib/neohub-account";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const session = await getSession(req, res);
    if (!session?.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const currentAuth0Sub = session.user.sub;
    const { neohubAccountId, password } = req.body;

    if (!neohubAccountId || !password) {
      return res.status(400).json({ error: "Missing neohubAccountId or password" });
    }

    // Check if current auth0_sub already has an account
    const existingAccount = await getNeoHubAccountByAuth0Sub(currentAuth0Sub);
    if (existingAccount) {
      return res.status(400).json({
        error: "This social account is already linked to a NeoHub account",
        neohubAccountId: existingAccount.id,
      });
    }

    // Verify password for target NeoHub account
    const isValid = await verifyAccountPassword(neohubAccountId, password);
    if (!isValid) {
      return res.status(401).json({ error: "Invalid password" });
    }

    // Extract provider info
    const provider = currentAuth0Sub.split("|")[0] || "unknown";
    const providerUserId = currentAuth0Sub.includes("|") ? currentAuth0Sub.split("|")[1] : currentAuth0Sub;

    // Link identity to NeoHub account
    await linkIdentity({
      neohubAccountId,
      auth0Sub: currentAuth0Sub,
      provider,
      providerUserId,
      email: session.user.email,
      name: session.user.name,
      avatar: session.user.picture,
    });

    return res.status(200).json({
      success: true,
      message: "Social account successfully linked to NeoHub account",
      neohubAccountId,
    });
  } catch (error) {
    console.error("Bind social account error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
