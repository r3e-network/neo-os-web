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

  if (typeof metadataAddress === "string") {
    const wallet = metadataAddress.trim();
    if (isValidNeoAddress(wallet)) {
      return wallet;
    }
  }

  if (typeof user.email === "string") {
    const emailMatch = user.email.trim().match(WALLET_EMAIL_REGEX);
    if (emailMatch?.[1] && isValidNeoAddress(emailMatch[1])) {
      return emailMatch[1];
    }
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
  if (error || !data?.user) {
    apiError.unauthorized(res, "Invalid or expired authorization token");
    return null;
  }

  const wallet = extractWalletFromUser(data.user);
  if (!wallet) {
    apiError.unauthorized(res, "Unable to resolve wallet from authenticated user");
    return null;
  }

  return wallet;
}
