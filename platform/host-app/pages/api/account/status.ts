/**
 * Account Status API - Check if OAuth user has NeoHub account
 * GET /api/account/status
 *
 * Returns:
 * - hasAccount: boolean
 * - neohubAccountId: string (if exists)
 * - address: string (primary Neo address if exists)
 * - linkedIdentities: array of linked social accounts
 * - linkedNeoAccounts: array of linked Neo accounts
 * - needsPasswordSetup: boolean
 */
import { getSession, withApiAuthRequired } from "@auth0/nextjs-auth0";
import type { NextApiRequest, NextApiResponse } from "next";
import { getNeoHubAccountByAuth0Sub, updateLastLogin } from "@/lib/neohub-account";
import type { LinkedIdentity, LinkedNeoAccount } from "@/lib/neohub-account";

interface AccountStatus {
  hasAccount: boolean;
  neohubAccountId?: string;
  address?: string;
  publicKey?: string;
  linkedIdentities?: LinkedIdentity[];
  linkedNeoAccounts?: LinkedNeoAccount[];
  needsPasswordSetup: boolean;
  oauthProvider?: string;
}

export default withApiAuthRequired(async function handler(
  req: NextApiRequest,
  res: NextApiResponse<AccountStatus | { error: string }>,
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const session = await getSession(req, res);
    if (!session?.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const auth0Sub = session.user.sub;
    const oauthProvider = session.user.sub?.split("|")[0] || "unknown";

    // Check NeoHub account by auth0_sub
    const account = await getNeoHubAccountByAuth0Sub(auth0Sub);

    if (account) {
      // Update last login
      await updateLastLogin(account.id);

      // Find primary Neo account
      const primaryNeo = account.linkedNeoAccounts.find((n) => n.isPrimary);

      return res.json({
        hasAccount: true,
        neohubAccountId: account.id,
        address: primaryNeo?.address,
        publicKey: primaryNeo?.publicKey,
        linkedIdentities: account.linkedIdentities,
        linkedNeoAccounts: account.linkedNeoAccounts,
        needsPasswordSetup: false,
        oauthProvider,
      });
    }

    // No account - needs setup
    return res.json({
      hasAccount: false,
      needsPasswordSetup: true,
      oauthProvider,
    });
  } catch (error) {
    console.error("Account status check error:", error);
    return res.status(500).json({ error: "Failed to check account status" });
  }
});
