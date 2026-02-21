import { timingSafeEqual } from "crypto";
import type { NextApiRequest, NextApiResponse } from "next";
import { apiError } from "@/lib/api-response";
import { requireWalletAuth } from "@/lib/require-wallet-auth";

export type AdminActor = {
  kind: "api_key" | "wallet";
  value: string;
};

function safeCompare(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

function getAdminApiKeyFromRequest(req: NextApiRequest): string {
  const header = req.headers["x-admin-key"];
  if (!header) return "";
  return Array.isArray(header) ? String(header[0] || "").trim() : String(header).trim();
}

function getAllowedAdminWallets(): Set<string> {
  const raw = String(process.env.MINIAPP_ADMIN_WALLETS || "").trim();
  if (!raw) return new Set<string>();
  return new Set(
    raw
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  );
}

export async function requireMiniAppAdmin(req: NextApiRequest, res: NextApiResponse): Promise<AdminActor | null> {
  const configuredApiKey = String(process.env.MINIAPP_ADMIN_API_KEY || "").trim();
  const requestApiKey = getAdminApiKeyFromRequest(req);
  const allowlist = getAllowedAdminWallets();

  if (configuredApiKey) {
    if (requestApiKey) {
      if (!safeCompare(requestApiKey, configuredApiKey)) {
        apiError.unauthorized(res, "Invalid admin API key");
        return null;
      }
      return { kind: "api_key", value: "api_key" };
    }
    if (allowlist.size === 0) {
      apiError.unauthorized(res, "Missing admin API key");
      return null;
    }
  }

  if (allowlist.size === 0 && !configuredApiKey) {
    apiError.configError(res, "No miniapp admin auth method configured");
    return null;
  }

  const wallet = await requireWalletAuth(req, res);
  if (!wallet) return null;

  if (allowlist.size > 0 && !allowlist.has(wallet)) {
    apiError.forbidden(res, "Wallet is not allowed to manage miniapps");
    return null;
  }

  return { kind: "wallet", value: wallet };
}
