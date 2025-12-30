import type { NextApiRequest, NextApiResponse } from "next";

const TWITTER_CLIENT_ID = process.env.TWITTER_CLIENT_ID || "demo-client-id";
const TWITTER_CLIENT_SECRET = process.env.TWITTER_CLIENT_SECRET || "demo-secret";
const REDIRECT_URI = process.env.NEXTAUTH_URL
  ? `${process.env.NEXTAUTH_URL}/api/oauth/twitter/callback`
  : "http://localhost:3000/api/oauth/twitter/callback";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
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

    return sendSuccess(res, {
      provider: "twitter",
      id: user.id,
      name: user.name,
      avatar: user.profile_image_url,
      linkedAt: new Date().toISOString(),
    });
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
