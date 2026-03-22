import type { NextApiRequest, NextApiResponse } from "next";
import { apiError } from "@/lib/api-response";
import { standardLimit } from "@/lib/rate-limit";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (standardLimit(req, res)) return;

  const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID;
  const NEXTAUTH_URL = process.env.NEXTAUTH_URL;

  if (!GITHUB_CLIENT_ID || !NEXTAUTH_URL) {
    return apiError.internal(res, "OAuth not configured");
  }

  const REDIRECT_URI = `${NEXTAUTH_URL}/api/oauth/github/callback`;
  const state = generateState();
  res.setHeader("Cache-Control", "no-store, private");
  res.setHeader("Set-Cookie", `oauth_state=${state}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600${process.env.NODE_ENV === "production" ? "; Secure" : ""}`);

  const authUrl =
    `https://github.com/login/oauth/authorize?` +
    `client_id=${GITHUB_CLIENT_ID}&` +
    `redirect_uri=${encodeURIComponent(REDIRECT_URI)}&` +
    `scope=user:email&` +
    `state=${state}`;

  return res.redirect(authUrl);
}

function generateState(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("");
}
