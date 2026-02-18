import type { NextApiRequest, NextApiResponse } from "next";
import crypto from "crypto";
import { apiError } from "@/lib/api-response";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
  const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
  const NEXTAUTH_URL = process.env.NEXTAUTH_URL;

  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    return apiError.internal(res, "OAuth not configured");
  }
  if (!NEXTAUTH_URL) {
    return apiError.internal(res, "NEXTAUTH_URL not configured");
  }

  const REDIRECT_URI = `${NEXTAUTH_URL}/api/oauth/google/callback`;

  const { code, state, error } = req.query;

  if (error) {
    return sendError(res, String(error));
  }

  // Verify state for CSRF protection (timing-safe)
  const storedState = req.cookies.oauth_state;
  const stateStr = typeof state === "string" ? state : "";
  const stateValid = stateStr && storedState &&
    Buffer.byteLength(stateStr) === Buffer.byteLength(storedState) &&
    crypto.timingSafeEqual(Buffer.from(stateStr), Buffer.from(storedState));
  if (!stateValid) {
    return sendError(res, "Invalid state parameter");
  }

  if (!code) {
    return sendError(res, "Missing authorization code");
  }

  try {
    const oauthTimeout = 15000;

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
      signal: AbortSignal.timeout(oauthTimeout),
    });

    if (!tokenRes.ok) {
      throw new Error("Token exchange failed");
    }

    const tokens = await tokenRes.json();

    // Get user info
    const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
      signal: AbortSignal.timeout(oauthTimeout),
    });

    if (!userRes.ok) {
      throw new Error("Failed to get user info");
    }

    const user = await userRes.json();
    if (!user || !user.id) {
      throw new Error("Invalid Google API response");
    }

    // Send success to parent window
    return sendSuccess(res, {
      provider: "google",
      id: String(user.id),
      email: String(user.email || ""),
      name: String(user.name || ""),
      avatar: user.picture,
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
  res.send(`
    <script>
      window.opener.postMessage({
        type: "oauth-success",
        provider: "google",
        account: ${safeJSON(account)}
      }, window.location.origin);
      window.close();
    </script>
  `);
}

function sendError(res: NextApiResponse, error: string) {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.send(`
    <script>
      window.opener.postMessage({
        type: "oauth-error",
        provider: "google",
        error: ${safeJSON(error)}
      }, window.location.origin);
      window.close();
    </script>
  `);
}
