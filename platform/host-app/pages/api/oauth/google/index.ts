import type { NextApiRequest, NextApiResponse } from "next";
import { apiError } from "@/lib/api-response";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
  const NEXTAUTH_URL = process.env.NEXTAUTH_URL;

  if (!GOOGLE_CLIENT_ID || !NEXTAUTH_URL) {
    return apiError.internal(res, "OAuth not configured");
  }

  const REDIRECT_URI = `${NEXTAUTH_URL}/api/oauth/google/callback`;
  const scope = encodeURIComponent("email profile");
  const state = generateState();

  res.setHeader("Set-Cookie", `oauth_state=${state}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600${process.env.NODE_ENV === "production" ? "; Secure" : ""}`);

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
