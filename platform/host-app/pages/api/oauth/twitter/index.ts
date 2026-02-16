import type { NextApiRequest, NextApiResponse } from "next";
import crypto from "crypto";
import { apiError } from "@/lib/api-response";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const TWITTER_CLIENT_ID = process.env.TWITTER_CLIENT_ID;
  const NEXTAUTH_URL = process.env.NEXTAUTH_URL;

  if (!TWITTER_CLIENT_ID || !NEXTAUTH_URL) {
    return apiError.internal(res, "OAuth not configured");
  }

  const REDIRECT_URI = `${NEXTAUTH_URL}/api/oauth/twitter/callback`;
  const state = generateState();
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = crypto
    .createHash("sha256")
    .update(codeVerifier)
    .digest("base64url");

  const prod = process.env.NODE_ENV === "production";
  res.setHeader("Set-Cookie", [
    `oauth_state=${state}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600${prod ? "; Secure" : ""}`,
    `code_verifier=${codeVerifier}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600${prod ? "; Secure" : ""}`,
  ]);

  const authUrl =
    `https://twitter.com/i/oauth2/authorize?` +
    `client_id=${TWITTER_CLIENT_ID}&` +
    `redirect_uri=${encodeURIComponent(REDIRECT_URI)}&` +
    `response_type=code&` +
    `scope=tweet.read%20users.read&` +
    `state=${state}&` +
    `code_challenge=${codeChallenge}&` +
    `code_challenge_method=S256`;

  res.redirect(authUrl);
}

function generateState(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("");
}

function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("");
}
