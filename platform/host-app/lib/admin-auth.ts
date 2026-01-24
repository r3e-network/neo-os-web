import { env } from "./env";

export type AdminAuthResult = { ok: true } | { ok: false; status: number; error: string };

function resolveAdminKey(): string | null {
  const key =
    env.ADMIN_CONSOLE_API_KEY ||
    env.ADMIN_API_KEY ||
    process.env.ADMIN_CONSOLE_API_KEY ||
    process.env.ADMIN_API_KEY ||
    process.env.NEXT_PUBLIC_ADMIN_CONSOLE_API_KEY ||
    process.env.NEXT_PUBLIC_ADMIN_API_KEY ||
    "";
  return key ? key.trim() : null;
}

function extractBearer(value?: string | string[]): string | null {
  const header = Array.isArray(value) ? value[0] : value;
  if (!header) return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : header.trim();
}

export function requireAdmin(headers: Record<string, string | string[] | undefined>): AdminAuthResult {
  const expected = resolveAdminKey();
  if (!expected) {
    return { ok: false, status: 500, error: "Admin API key not configured" };
  }

  const headerKey =
    extractBearer(headers.authorization) ||
    extractBearer(headers["x-admin-key"]) ||
    extractBearer(headers["x-admin-token"]);

  if (!headerKey || headerKey !== expected) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }

  return { ok: true };
}

export function getAdminKeyConfigured(): boolean {
  return Boolean(resolveAdminKey());
}
