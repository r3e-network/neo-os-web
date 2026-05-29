export const HASH160_PATTERN = /^(0x)?[0-9a-fA-F]{40}$/;
export const NEO_ADDRESS_PATTERN = /^N[1-9A-HJ-NP-Za-km-z]{33}$/;
export const MIN_RECOVERY_EXPIRY_MINUTES = 5;
export const MAX_RECOVERY_EXPIRY_MINUTES = 1440;

export function isHash160(value: unknown): boolean {
  return HASH160_PATTERN.test(String(value ?? "").trim());
}

export function isNeoAddress(value: unknown): boolean {
  return NEO_ADDRESS_PATTERN.test(String(value ?? "").trim());
}

export function isAccountLocator(value: unknown): boolean {
  return isHash160(value) || isNeoAddress(value);
}

export function isOptionalHash160(value: unknown): boolean {
  const trimmed = String(value ?? "").trim();
  return !trimmed || isHash160(trimmed);
}

export function isRecoveryExpiryMinutes(value: unknown): boolean {
  return parseRecoveryExpiryMinutes(value) !== null;
}

export function parseRecoveryExpiryMinutes(value: unknown): number | null {
  const raw = String(value ?? "").trim();
  if (!/^\d+$/.test(raw)) return null;
  const minutes = Number(raw);
  if (
    Number.isInteger(minutes) &&
    minutes >= MIN_RECOVERY_EXPIRY_MINUTES &&
    minutes <= MAX_RECOVERY_EXPIRY_MINUTES
  ) {
    return minutes;
  }
  return null;
}
