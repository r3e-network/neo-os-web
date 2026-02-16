import type { NextApiRequest, NextApiResponse } from "next";
import crypto from "crypto";
import { apiError } from "@/lib/api-response";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const TWITTER_CLIENT_ID = process.env.TWITTER_CLIENT_ID;
  const TWITTER_CLIENT_SECRET = process.env.TWITTER_CLIENT_SECRET;
  const NEXTAUTH_URL = process.env.NEXTAUTH_URL;

  if (!TWITTER_CLIENT_ID || !TWITTER_CLIENT_SECRET) {
    return apiError.internal(res, "OAuth not configured");
  }
  if (!NEXTAUTH_URL) {
    return apiError.internal(res, "NEXTAUTH_URL not configured");
  }

  const REDIRECT_URI = `${NEXTAUTH_URL}/api/oauth/twitter/callback`;

  const { code, state, error } = req.query;

  if (error) return sendError(res, String(error));

  const storedState = req.cookies.oauth_state;
  const codeVerifier = req.cookies.code_verifier;

  const stateStr = typeof state === "string" ? state : "";
  const stateValid = stateStr && storedState &&
    Buffer.byteLength(stateStr) === Buffer.byteLength(storedState) &&
    crypto.timingSafeEqual(Buffer.from(stateStr), Buffer.from(storedState));
  if (!stateValid) {
    return sendError(res, "Invalid state");
  }

  if (!code || !codeVerifier) {
    return sendError(res, "Missing code or verifier");
  }

  try {
    const oauthTimeout = 15000;

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
      signal: AbortSignal.timeout(oauthTimeout),
    });

    const tokens = await tokenRes.json();
    if (tokens.error) throw new Error(tokens.error_description || tokens.error);

    // Get user info
    const userRes = await fetch("https://api.twitter.com/2/users/me", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
      signal: AbortSignal.timeout(oauthTimeout),
    });
    const userData = await userRes.json();
    const user = userData?.data;
    if (!user || !user.id) {
      throw new Error("Invalid Twitter API response");
    }

    return sendSuccess(res, {
      provider: "twitter",
      id: String(user.id),
      name: String(user.name || ""),
      avatar: user.profile_image_url,
      linkedAt: new Date().toISOString(),
    });
  } catch (err) {
    return sendError(res, err instanceof Error ? err.message : "OAuth failed");
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
      provider: "twitter",
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
      provider: "twitter",
      error: ${safeJSON(error)}
    }, window.location.origin);
    window.close();
  </script>`);
}
