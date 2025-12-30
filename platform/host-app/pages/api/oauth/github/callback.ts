import type { NextApiRequest, NextApiResponse } from "next";

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID || "demo-client-id";
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET || "demo-secret";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
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

    return sendSuccess(res, {
      provider: "github",
      id: String(user.id),
      email: primaryEmail || user.email,
      name: user.name || user.login,
      avatar: user.avatar_url,
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
