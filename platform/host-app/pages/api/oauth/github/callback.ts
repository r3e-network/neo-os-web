import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Require OAuth credentials
  if (!GITHUB_CLIENT_ID || !GITHUB_CLIENT_SECRET) {
    return sendError(res, "GitHub OAuth not configured");
  }

  const { code, state, error } = req.query;

  if (error) {
    return sendError(res, String(error));
  }

  const storedState = req.cookies.oauth_state;
  if (!state || state !== storedState) {
    return sendError(res, "Invalid state parameter");
  }

  if (!code) {
    return sendError(res, "Missing authorization code");
  }

  // Get wallet address from cookie (set during OAuth initiation)
  const walletAddress = req.cookies.oauth_wallet_address;
  if (!walletAddress) {
    return sendError(res, "Missing wallet address context");
  }

  try {
    // Exchange code for token
    const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        client_id: GITHUB_CLIENT_ID,
        client_secret: GITHUB_CLIENT_SECRET,
        code: String(code),
      }),
    });

    const tokens = await tokenRes.json();
    if (tokens.error) {
      throw new Error(tokens.error_description || tokens.error);
    }

    // Get user info
    const userRes = await fetch("https://api.github.com/user", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const user = await userRes.json();

    // Get primary email
    const emailRes = await fetch("https://api.github.com/user/emails", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const emails = await emailRes.json();
    const primaryEmail = emails.find((e: { primary: boolean }) => e.primary)?.email;

    const accountData = {
      provider: "github" as const,
      id: String(user.id),
      email: primaryEmail || user.email,
      name: user.name || user.login,
      avatar: user.avatar_url,
      linkedAt: new Date().toISOString(),
    };

    // Persist to database
    await supabase.from("oauth_accounts").upsert(
      {
        wallet_address: walletAddress,
        provider: "github",
        provider_user_id: String(user.id),
        email: accountData.email,
        name: accountData.name,
        avatar: accountData.avatar,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token || null,
        linked_at: accountData.linkedAt,
        last_used_at: new Date().toISOString(),
      },
      { onConflict: "wallet_address,provider" },
    );

    return sendSuccess(res, accountData);
  } catch (err) {
    return sendError(res, err instanceof Error ? err.message : "OAuth failed");
  }
}

function sendSuccess(res: NextApiResponse, account: object) {
  res.setHeader("Content-Type", "text/html");
  res.send(`<script>
    window.opener.postMessage({
      type: "oauth-success",
      provider: "github",
      account: ${JSON.stringify(account)}
    }, window.location.origin);
    window.close();
  </script>`);
}

function sendError(res: NextApiResponse, error: string) {
  res.setHeader("Content-Type", "text/html");
  res.send(`<script>
    window.opener.postMessage({
      type: "oauth-error",
      provider: "github",
      error: ${JSON.stringify(error)}
    }, window.location.origin);
    window.close();
  </script>`);
}
