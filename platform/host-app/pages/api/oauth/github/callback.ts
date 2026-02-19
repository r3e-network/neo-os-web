import type { NextApiRequest, NextApiResponse } from "next";
import crypto from "crypto";
import { apiError } from "@/lib/api-response";
import { strictLimit } from "@/lib/rate-limit";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (strictLimit(req, res)) return;
  const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID;
  const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;

  if (!GITHUB_CLIENT_ID || !GITHUB_CLIENT_SECRET) {
    return apiError.internal(res, "OAuth not configured");
  }

  const { code, state, error } = req.query;

  if (error) {
    return sendError(res, String(error));
  }

  const storedState = req.cookies.oauth_state;
  const stateStr = typeof state === "string" ? state : "";
  const stateValid = stateStr && storedState &&
    Buffer.byteLength(stateStr) === Buffer.byteLength(storedState) &&
    crypto.timingSafeEqual(Buffer.from(stateStr), Buffer.from(storedState));
  if (!stateValid) {
    return sendError(res, "Invalid state parameter");
  }

  // Clear state cookie to prevent replay
  const secureSuffix = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.setHeader("Set-Cookie", `oauth_state=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${secureSuffix}`);

  if (!code) {
    return sendError(res, "Missing authorization code");
  }

  try {
    const oauthTimeout = 15000;

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
      signal: AbortSignal.timeout(oauthTimeout),
    });

    const tokens = await tokenRes.json();
    if (tokens.error) {
      throw new Error(tokens.error_description || tokens.error);
    }

    // Get user info
    const userRes = await fetch("https://api.github.com/user", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
      signal: AbortSignal.timeout(oauthTimeout),
    });
    if (!userRes.ok) {
      throw new Error("Failed to get GitHub user info");
    }
    const user = await userRes.json();
    if (!user || !user.id) {
      throw new Error("Invalid GitHub API response");
    }

    // Get primary email
    const emailRes = await fetch("https://api.github.com/user/emails", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
      signal: AbortSignal.timeout(oauthTimeout),
    });
    const emailsData = emailRes.ok ? await emailRes.json() : [];
    const emails = Array.isArray(emailsData) ? emailsData : [];
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
    return sendError(res, "OAuth failed");
  }
}

/** Escape JSON for safe embedding inside <script> tags (prevents XSS via </script> injection). */
function safeJSON(obj: unknown): string {
  return JSON.stringify(obj).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");
}

function sendSuccess(res: NextApiResponse, account: object) {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.send(`<script>
    window.opener.postMessage({
      type: "oauth-success",
      provider: "github",
      account: ${safeJSON(account)}
    }, window.location.origin);
    window.close();
  </script>`);
}

function sendError(res: NextApiResponse, error: string) {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.send(`<script>
    window.opener.postMessage({
      type: "oauth-error",
      provider: "github",
      error: ${safeJSON(error)}
    }, window.location.origin);
    window.close();
  </script>`);
}
