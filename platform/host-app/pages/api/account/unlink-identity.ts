/**
 * API: Unlink social identity from NeoHub account
 * POST /api/account/unlink-identity
 *
 * Requires password verification and at least 1 identity or Neo account remaining.
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { getSession } from "@auth0/nextjs-auth0";
import { getNeoHubAccountByAuth0Sub, unlinkIdentity } from "@/lib/neohub-account";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const session = await getSession(req, res);
    if (!session?.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { identityId, password } = req.body;

    if (!identityId || !password) {
      return res.status(400).json({ error: "Missing identityId or password" });
    }

    // Get current user's NeoHub account
    const account = await getNeoHubAccountByAuth0Sub(session.user.sub);
    if (!account) {
      return res.status(404).json({ error: "NeoHub account not found" });
    }

    // Unlink identity
    const result = await unlinkIdentity(account.id, identityId, password);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Unlink identity error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
