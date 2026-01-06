import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const TWITTER_CLIENT_ID = process.env.TWITTER_CLIENT_ID;
const TWITTER_CLIENT_SECRET = process.env.TWITTER_CLIENT_SECRET;
const REDIRECT_URI = process.env.NEXTAUTH_URL
  ? `${process.env.NEXTAUTH_URL}/api/oauth/twitter/callback`
  : "http://localhost:3000/api/oauth/twitter/callback";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Require OAuth credentials
  if (!TWITTER_CLIENT_ID || !TWITTER_CLIENT_SECRET) {
    return sendError(res, "Twitter OAuth not configured");
  }

  const { code, state, error } = req.query;

  if (error) return sendError(res, String(error));

  const storedState = req.cookies.oauth_state;
  const codeVerifier = req.cookies.code_verifier;

  if (!state || state !== storedState) {
    return sendError(res, "Invalid state");
  }

  if (!code || !codeVerifier) {
    return sendError(res, "Missing code or verifier");
  }

  // Get wallet address from cookie
  const walletAddress = req.cookies.oauth_wallet_address;
  if (!walletAddress) {
    return sendError(res, "Missing wallet address context");
  }

  try {
    // Exchange code for token
    const basicAuth = Buffer.from(`${TWITTER_CLIENT_ID}:${TWITTER_CLIENT_SECRET}`).toString("base64");

    const tokenRes = await fetch("https://api.twitter.com/2/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${basicAuth}`,
      },
      body: new URLSearchParams({
        code: String(code),
        grant_type: "authorization_code",
        redirect_uri: REDIRECT_URI,
        code_verifier: codeVerifier,
      }),
    });

    const tokens = await tokenRes.json();
    if (tokens.error) throw new Error(tokens.error_description || tokens.error);

    // Get user info
    const userRes = await fetch("https://api.twitter.com/2/users/me", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const userData = await userRes.json();
    const user = userData.data;

    const accountData = {
      provider: "twitter" as const,
      id: user.id,
      name: user.name,
      avatar: user.profile_image_url,
      linkedAt: new Date().toISOString(),
    };

    // Persist to database
    await supabase.from("oauth_accounts").upsert(
      {
        wallet_address: walletAddress,
        provider: "twitter",
        provider_user_id: user.id,
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
      provider: "twitter",
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
      provider: "twitter",
      error: ${JSON.stringify(error)}
    }, window.location.origin);
    window.close();
  </script>`);
}
