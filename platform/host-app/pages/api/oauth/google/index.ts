import type { NextApiRequest, NextApiResponse } from "next";

// OAuth configuration (use environment variables in production)
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "demo-client-id";
const REDIRECT_URI = process.env.NEXTAUTH_URL
  ? `${process.env.NEXTAUTH_URL}/api/oauth/google/callback`
  : "http://localhost:3000/api/oauth/google/callback";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const scope = encodeURIComponent("email profile");
  const state = generateState();

  // Store state in cookie for CSRF protection
  res.setHeader("Set-Cookie", `oauth_state=${state}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600`);

  const authUrl =
    `https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=${GOOGLE_CLIENT_ID}&` +
    `redirect_uri=${encodeURIComponent(REDIRECT_URI)}&` +
    `response_type=code&` +
    `scope=${scope}&` +
    `state=${state}&` +
    `access_type=offline&` +
    `prompt=consent`;

  res.redirect(authUrl);
}

function generateState(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("");
}
