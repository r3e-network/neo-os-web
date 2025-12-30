import type { NextApiRequest, NextApiResponse } from "next";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "demo-client-id";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "demo-secret";
const REDIRECT_URI = process.env.NEXTAUTH_URL
  ? `${process.env.NEXTAUTH_URL}/api/oauth/google/callback`
  : "http://localhost:3000/api/oauth/google/callback";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { code, state, error } = req.query;

  if (error) {
    return sendError(res, String(error));
  }

  // Verify state for CSRF protection
  const storedState = req.cookies.oauth_state;
  if (!state || state !== storedState) {
    return sendError(res, "Invalid state parameter");
  }

  if (!code) {
    return sendError(res, "Missing authorization code");
  }

  try {
    // Exchange code for tokens
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code: String(code),
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenRes.ok) {
      throw new Error("Token exchange failed");
    }

    const tokens = await tokenRes.json();

    // Get user info
    const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    if (!userRes.ok) {
      throw new Error("Failed to get user info");
    }

    const user = await userRes.json();

    // Send success to parent window
    return sendSuccess(res, {
      provider: "google",
      id: user.id,
      email: user.email,
      name: user.name,
      avatar: user.picture,
      linkedAt: new Date().toISOString(),
    });
  } catch (err) {
    return sendError(res, err instanceof Error ? err.message : "OAuth failed");
  }
}

function sendSuccess(res: NextApiResponse, account: object) {
  res.setHeader("Content-Type", "text/html");
  res.send(`
    <script>
      window.opener.postMessage({
        type: "oauth-success",
        provider: "google",
        account: ${JSON.stringify(account)}
      }, window.location.origin);
      window.close();
    </script>
  `);
}

function sendError(res: NextApiResponse, error: string) {
  res.setHeader("Content-Type", "text/html");
  res.send(`
    <script>
      window.opener.postMessage({
        type: "oauth-error",
        provider: "google",
        error: ${JSON.stringify(error)}
      }, window.location.origin);
      window.close();
    </script>
  `);
}
