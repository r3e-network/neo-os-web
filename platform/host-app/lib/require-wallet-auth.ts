import { createHmac, timingSafeEqual } from "crypto";
import type { NextApiRequest, NextApiResponse } from "next";
import { apiError } from "@/lib/api-response";
import { isValidNeoAddress } from "@/lib/neo-address";
import { getServerSupabaseClient } from "@/lib/server-supabase";

const WALLET_EMAIL_REGEX = /^(N[A-Za-z0-9]{33})@wallet\.neo$/i;

function getBearerToken(req: NextApiRequest): string | null {
  const authHeader = req.headers.authorization;
  const headerValue = Array.isArray(authHeader) ? authHeader[0] : authHeader;
  if (!headerValue) return null;

  const match = headerValue.match(/^Bearer\s+(.+)$/i);
  if (!match?.[1]) return null;
  return match[1].trim();
}

function extractWalletFromUser(user: { user_metadata?: unknown; email?: string | null }): string | null {
  const metadata = user.user_metadata;
  const metadataAddress = typeof metadata === "object" && metadata !== null
    ? (metadata as { address?: unknown }).address
    : undefined;

  return extractWalletFromClaims({ address: metadataAddress, email: user.email });
}

function decodeBase64UrlJson(value: string): Record<string, unknown> | null {
  try {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
    return JSON.parse(Buffer.from(padded, "base64").toString("utf8"));
  } catch (_e: unknown) {
    return null;
  }
}

function encodeBase64Url(value: Buffer): string {
  return value.toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function verifyHs256Jwt(token: string, secret: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const header = decodeBase64UrlJson(encodedHeader);
  if (header?.alg !== "HS256") return null;

  const expected = encodeBase64Url(
    createHmac("sha256", secret).update(`${encodedHeader}.${encodedPayload}`).digest(),
  );
  const actual = Buffer.from(encodedSignature);
  const expectedBuffer = Buffer.from(expected);
  if (actual.length !== expectedBuffer.length || !timingSafeEqual(actual, expectedBuffer)) return null;

  const payload = decodeBase64UrlJson(encodedPayload);
  if (!payload) return null;
  if (payload.aud !== "authenticated" || payload.role !== "authenticated") return null;
  if (typeof payload.sub !== "string" || payload.sub.trim().length === 0) return null;
  if (typeof payload.exp !== "number" || !Number.isFinite(payload.exp)) return null;
  if (payload.exp <= Math.floor(Date.now() / 1000)) return null;
  return payload;
}

function extractWalletFromClaims(claims: Record<string, unknown>): string | null {
  const metadata = claims.user_metadata;
  const metadataAddress = typeof metadata === "object" && metadata !== null
    ? (metadata as { address?: unknown }).address
    : undefined;
  const candidates = [claims.address, metadataAddress];
  for (const value of candidates) {
    if (typeof value !== "string") continue;
    const wallet = value.trim();
    if (isValidNeoAddress(wallet)) return wallet;
  }

  const email = typeof claims.email === "string" ? claims.email : null;
  if (email) {
    const emailMatch = email.trim().match(WALLET_EMAIL_REGEX);
    if (emailMatch?.[1] && isValidNeoAddress(emailMatch[1])) {
      return emailMatch[1];
    }
  }

  return null;
}

function extractWalletFromLocalJwt(token: string): string | null {
  const secrets = [process.env.SUPABASE_JWT_SECRET, process.env.NEXTAUTH_SECRET]
    .map((value) => String(value || "").trim())
    .filter(Boolean);
  for (const secret of secrets) {
    const payload = verifyHs256Jwt(token, secret);
    if (!payload) continue;
    const wallet = extractWalletFromClaims(payload);
    if (wallet) return wallet;
  }
  return null;
}

export async function requireWalletAuth(req: NextApiRequest, res: NextApiResponse): Promise<string | null> {
  const token = getBearerToken(req);
  if (!token) {
    apiError.unauthorized(res, "Missing or invalid authorization token");
    return null;
  }

  const supabase = getServerSupabaseClient();
  if (!supabase) {
    apiError.unauthorized(res, "Authentication unavailable");
    return null;
  }

  const { data, error } = await supabase.auth.getUser(token);
  if (!error && data?.user) {
    const wallet = extractWalletFromUser(data.user);
    if (wallet) return wallet;
  }

  const localJwtWallet = extractWalletFromLocalJwt(token);
  if (localJwtWallet) return localJwtWallet;

  apiError.unauthorized(res, "Invalid or expired authorization token");
  return null;
}
