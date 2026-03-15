export const parseBigInt = (value: unknown): bigint => {
  try {
    return BigInt(String(value ?? "0"));
  } catch {
    return 0n;
  }
};

export const parseBool = (value: unknown): boolean =>
  value === true || value === "true" || value === 1 || value === "1";

export const encodeTokenId = (tokenId: string): string => {
  try {
    const bytes = new TextEncoder().encode(tokenId);
    return btoa(String.fromCharCode(...bytes));
  } catch {
    return tokenId;
  }
};

export const parseDateInput = (value: string): number => {
  const trimmed = value.trim();
  if (!trimmed) return 0;
  const normalized = trimmed.includes("T") ? trimmed : trimmed.replace(" ", "T");
  const parsed = Date.parse(normalized);
  if (Number.isNaN(parsed)) return 0;
  return Math.floor(parsed / 1000);
};
