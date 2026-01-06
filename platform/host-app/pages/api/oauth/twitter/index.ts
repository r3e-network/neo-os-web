import type { NextApiRequest, NextApiResponse } from "next";

const TWITTER_CLIENT_ID = process.env.TWITTER_CLIENT_ID;
const REDIRECT_URI = process.env.NEXTAUTH_URL
  ? `${process.env.NEXTAUTH_URL}/api/oauth/twitter/callback`
  : "http://localhost:3000/api/oauth/twitter/callback";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  // Require OAuth credentials
  if (!TWITTER_CLIENT_ID) {
    return res.status(503).json({ error: "Twitter OAuth not configured" });
  }

  // Get wallet address from query param
  const walletAddress = req.query.wallet_address as string;
  if (!walletAddress) {
    return res.status(400).json({ error: "wallet_address required" });
  }

  const state = generateState();
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = codeVerifier; // Using plain method for PKCE

  res.setHeader("Set-Cookie", [
    `oauth_state=${state}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600`,
    `code_verifier=${codeVerifier}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600`,
    `oauth_wallet_address=${walletAddress}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600`,
  ]);

  const authUrl =
    `https://twitter.com/i/oauth2/authorize?` +
    `client_id=${TWITTER_CLIENT_ID}&` +
    `redirect_uri=${encodeURIComponent(REDIRECT_URI)}&` +
    `response_type=code&` +
    `scope=tweet.read%20users.read&` +
    `state=${state}&` +
    `code_challenge=${codeChallenge}&` +
    `code_challenge_method=plain`;

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
