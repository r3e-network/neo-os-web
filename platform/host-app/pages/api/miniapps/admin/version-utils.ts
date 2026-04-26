import type { NextApiRequest } from "next";

export const APP_ID_REGEX = /^[a-z0-9][a-z0-9._-]*$/;
export const VERSION_ID_REGEX =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;

export function asTrimmedString(value: unknown): string {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

export function parseReleaseChannel(
  value: unknown,
): "all" | "draft" | "published" {
  const normalized = asTrimmedString(value).toLowerCase();
  if (
    normalized === "draft" ||
    normalized === "published" ||
    normalized === "all"
  ) {
    return normalized;
  }
  return "all";
}

export function parseRollbackReleaseChannel(
  value: unknown,
): "draft" | "published" {
  const channel = parseReleaseChannel(value);
  return channel === "draft" ? "draft" : "published";
}

export function parseVersionNo(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) {
    return value;
  }

  const raw = asTrimmedString(value);
  if (!raw) return null;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
}

export function getQueryString(req: NextApiRequest, key: string): string {
  const value = req.query[key];
  if (Array.isArray(value)) return asTrimmedString(value[0]);
  return asTrimmedString(value);
}
