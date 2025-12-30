import type { NextApiRequest, NextApiResponse } from "next";

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID || "demo-client-id";
const REDIRECT_URI = process.env.NEXTAUTH_URL
  ? `${process.env.NEXTAUTH_URL}/api/oauth/github/callback`
  : "http://localhost:3000/api/oauth/github/callback";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const state = generateState();
  res.setHeader("Set-Cookie", `oauth_state=${state}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600`);

  const authUrl =
    `https://github.com/login/oauth/authorize?` +
    `client_id=${GITHUB_CLIENT_ID}&` +
    `redirect_uri=${encodeURIComponent(REDIRECT_URI)}&` +
    `scope=user:email&` +
    `state=${state}`;

  res.redirect(authUrl);
}

function generateState(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("");
}
