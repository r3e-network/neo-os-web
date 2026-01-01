/**
 * Input validation utilities
 */

export function isValidWalletAddress(address: string): boolean {
  if (!address || typeof address !== "string") return false;
  // Neo N3 address format: starts with N, 34 characters
  return /^N[A-Za-z0-9]{33}$/.test(address);
}

export function isValidAppId(appId: string): boolean {
  if (!appId || typeof appId !== "string") return false;
  // Allow alphanumeric, hyphens, underscores, 1-64 chars
  return /^[a-zA-Z0-9_-]{1,64}$/.test(appId);
}

export function sanitizeString(input: string, maxLength = 500): string {
  if (!input || typeof input !== "string") return "";
  return input.trim().slice(0, maxLength);
}

export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== "string") return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
