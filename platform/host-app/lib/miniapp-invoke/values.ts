import type { OperationEntry } from "../../components/types";
import { addressToScriptHash } from "../chain";
import {
  buildInvokeArgs,
  parseScaledDecimal,
} from "../miniapp-detail-helpers";
import type { NeoNetwork } from "../neo-network";
import {
  RECOVERY_DEFAULT_ENCRYPTED_PARAMS,
  RECOVERY_DEFAULT_PROVIDER,
} from "./constants";

const FIXED8_DECIMALS = 100000000n;
const DAY_MS = 86_400_000;
const SECOND_EPOCH_THRESHOLD = 1_000_000_000_000n;

export function base64FromBytes(bytes: number[]): string {
  const alphabet =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let output = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i] ?? 0;
    const b = bytes[i + 1] ?? 0;
    const c = bytes[i + 2] ?? 0;
    const triplet = (a << 16) | (b << 8) | c;
    output += alphabet[(triplet >> 18) & 63];
    output += alphabet[(triplet >> 12) & 63];
    output += i + 1 < bytes.length ? alphabet[(triplet >> 6) & 63] : "=";
    output += i + 2 < bytes.length ? alphabet[triplet & 63] : "=";
  }
  return output;
}

export function hash160ToLittleEndianBase64(hash: string): string {
  const hex = hash.trim().replace(/^0x/i, "");
  if (!/^[0-9a-fA-F]{40}$/.test(hex)) {
    throw new Error("Oracle callback contract hash is invalid.");
  }
  const bytes = hex.match(/.{2}/g)?.map((byte) => parseInt(byte, 16)) || [];
  return base64FromBytes(bytes.reverse());
}

export function formatFixed8Amount(units: bigint): string {
  const sign = units < 0n ? "-" : "";
  const absolute = units < 0n ? -units : units;
  const whole = absolute / FIXED8_DECIMALS;
  const fraction = (absolute % FIXED8_DECIMALS)
    .toString()
    .padStart(8, "0")
    .replace(/0+$/, "");
  return `${sign}${whole.toString()}${fraction ? `.${fraction}` : ""}`;
}

export function firstNonEmptyValue(
  values: Record<string, string>,
  names: string[],
): string {
  for (const name of names) {
    const value = String(values[name] || "").trim();
    if (value) return value;
  }
  return "";
}

export function positiveWholeValue(
  values: Record<string, string>,
  names: string[],
  label: string,
): string {
  const value = firstNonEmptyValue(values, names);
  if (!/^[1-9]\d*$/.test(value)) {
    throw new Error(`${label} must be a positive whole number.`);
  }
  return value;
}

export function integerRangeValue(
  values: Record<string, string>,
  names: string[],
  label: string,
  min: number,
  max: number,
): string {
  const value = firstNonEmptyValue(values, names);
  if (!/^\d+$/.test(value)) {
    throw new Error(`${label} must be an integer.`);
  }
  const numeric = Number(value);
  if (!Number.isSafeInteger(numeric) || numeric < min || numeric > max) {
    throw new Error(`${label} must be between ${min} and ${max}.`);
  }
  return value;
}

export function optionalIntegerRangeValue(
  values: Record<string, string>,
  names: string[],
  label: string,
  min: number,
  max: number,
  fallback = "0",
): string {
  const value = firstNonEmptyValue(values, names);
  if (!value) return fallback;
  if (!/^\d+$/.test(value)) {
    throw new Error(`${label} must be an integer.`);
  }
  const numeric = Number(value);
  if (!Number.isSafeInteger(numeric) || numeric < min || numeric > max) {
    throw new Error(`${label} must be between ${min} and ${max}.`);
  }
  return value;
}

export function optionalPositiveWholeValue(
  values: Record<string, string>,
  names: string[],
  label: string,
): string | null {
  const value = firstNonEmptyValue(values, names);
  if (!value) return null;
  if (!/^[1-9]\d*$/.test(value)) {
    throw new Error(`${label} must be a positive whole number.`);
  }
  return value;
}

export function optionalPositiveFixed8Value(
  values: Record<string, string>,
  names: string[],
  label: string,
): string | null {
  const value = firstNonEmptyValue(values, names);
  if (!value) return null;
  if (!/^\d+(?:\.\d+)?$/.test(value)) {
    throw new Error(`${label} must be a positive GAS value.`);
  }
  const scaled = parseScaledDecimal(value, 8, label);
  return BigInt(scaled) > 0n ? scaled : null;
}

export function normalizedSha256HashValue(
  values: Record<string, string>,
  names: string[],
  label: string,
): string {
  const value = firstNonEmptyValue(values, names).replace(/^0x/i, "");
  if (!/^[0-9a-fA-F]{64}$/.test(value)) {
    throw new Error(`${label} must be a 64-character SHA-256 hex string.`);
  }
  return value.toLowerCase();
}

export function normalizedSha256Hash(
  values: Record<string, string>,
  names: string[],
): string {
  return normalizedSha256HashValue(values, names, "Content hash");
}

export function hexToBase64(hex: string): string {
  const normalized = hex.replace(/^0x/i, "");
  const bytes = normalized.match(/.{2}/g)?.map((byte) => parseInt(byte, 16)) || [];
  return base64FromBytes(bytes);
}

function utf8Bytes(value: string): number[] {
  const encoded = encodeURIComponent(value);
  const bytes: number[] = [];
  for (let i = 0; i < encoded.length; i += 1) {
    if (encoded[i] === "%" && i + 2 < encoded.length) {
      bytes.push(parseInt(encoded.slice(i + 1, i + 3), 16));
      i += 2;
    } else {
      bytes.push(encoded.charCodeAt(i));
    }
  }
  return bytes;
}

export function utf8ToBase64(value: string): string {
  return base64FromBytes(utf8Bytes(value));
}

export function booleanOperationValue(
  values: Record<string, string>,
  names: string[],
  label: string,
  fallback = false,
): boolean {
  const value = firstNonEmptyValue(values, names).toLowerCase();
  if (!value) return fallback;
  if (["true", "1", "yes", "on", "public"].includes(value)) return true;
  if (["false", "0", "no", "off", "private"].includes(value)) return false;
  throw new Error(`${label} must be true or false.`);
}

export function futureUnlockTimeMsValue(values: Record<string, string>): string {
  const explicitValue = firstNonEmptyValue(values, [
    "unlockTimeMs",
    "unlockTime",
    "unlockTimestamp",
  ]);
  if (explicitValue) {
    if (!/^[1-9]\d*$/.test(explicitValue)) {
      throw new Error("Unlock time must be a positive epoch timestamp.");
    }
    let unlockTime = BigInt(explicitValue);
    if (unlockTime < SECOND_EPOCH_THRESHOLD) {
      unlockTime *= 1000n;
    }
    if (unlockTime <= BigInt(Date.now())) {
      throw new Error("Unlock time must be in the future.");
    }
    return unlockTime.toString();
  }

  const unlockDays = Number(
    integerRangeValue(values, ["unlockDays", "days"], "Lock duration", 1, 3650),
  );
  return Math.floor(Date.now() + unlockDays * DAY_MS).toString();
}

export function optionalVaultReceiptId(
  values: Record<string, string>,
  targetNetwork: NeoNetwork,
): string | null {
  const receiptId = optionalPositiveWholeValue(
    values,
    ["receiptId", "paymentReceiptId"],
    "Payment receipt ID",
  );
  if (targetNetwork === "mainnet" && !receiptId) {
    throw new Error(
      "Mainnet Unbreakable Vault operations require a payment receipt ID. Use testnet for the direct funded flow or enter an existing payment receipt ID.",
    );
  }
  return receiptId;
}

export function buildInvokeArgsWithoutParams(
  operation: OperationEntry,
  values: Record<string, string>,
  walletAddress: string,
  excludedParamNames: string[],
): Array<{ type: string; value: unknown }> {
  const excluded = new Set(excludedParamNames);
  return buildInvokeArgs(
    (operation.params ?? []).filter((param) => !excluded.has(param.name)),
    values,
    walletAddress,
  );
}

export function cleanValue(
  values: Record<string, string>,
  names: string[],
  fallback = "",
): string {
  const value = firstNonEmptyValue(values, names);
  return value || fallback;
}

export function boundedTextValue(
  values: Record<string, string>,
  names: string[],
  label: string,
  maxLength: number,
  required = false,
): string {
  const value = cleanValue(values, names).trim();
  if (required && !value) {
    throw new Error(`${label} is required.`);
  }
  if (value.length > maxLength) {
    throw new Error(`${label} must be ${maxLength} characters or fewer.`);
  }
  return value;
}

export function normalizeHostHash160Value(value: string, label: string): string {
  const raw = String(value || "").trim();
  if (!raw) throw new Error(`${label} is required.`);
  const hash = raw.startsWith("0x")
    ? raw.toLowerCase()
    : addressToScriptHash(raw);
  if (!/^0x[0-9a-f]{40}$/.test(hash)) {
    throw new Error(`${label} must be a Neo N3 address or 0x-prefixed Hash160.`);
  }
  return hash;
}

export function hash160OperationValue(
  values: Record<string, string>,
  names: string[],
  label: string,
  walletAddress: string,
): string {
  const value = firstNonEmptyValue(values, names);
  return normalizeHostHash160Value(
    value === "$wallet" ? walletAddress : value,
    label,
  );
}

export function accountIdByteArrayValue(
  values: Record<string, string>,
  names: string[],
  label: string,
): string {
  return normalizeHostHash160Value(firstNonEmptyValue(values, names), label);
}

export function recoveryExpiresAtText(values: Record<string, string>): string {
  const minutes = Number(
    integerRangeValue(
      values,
      ["expiryMinutes", "recoveryExpiryMinutes", "expiresInMinutes"],
      "Ticket expiry minutes",
      5,
      1440,
    ),
  );
  return String(Math.floor(Date.now() / 1000) + minutes * 60);
}

export function recoveryProviderValue(values: Record<string, string>): string {
  const provider =
    cleanValue(values, ["provider", "recoveryProvider"], RECOVERY_DEFAULT_PROVIDER).trim() ||
    RECOVERY_DEFAULT_PROVIDER;
  if (!/^[a-z0-9_-]{2,32}$/i.test(provider)) {
    throw new Error(
      "Recovery provider must be 2-32 letters, numbers, dashes, or underscores.",
    );
  }
  return provider;
}

export function recoveryEncryptedParamsValue(
  values: Record<string, string>,
): string {
  const params =
    cleanValue(
      values,
      ["encryptedParams", "encryptedSubject", "subjectParams"],
      RECOVERY_DEFAULT_ENCRYPTED_PARAMS,
    ).trim() || RECOVERY_DEFAULT_ENCRYPTED_PARAMS;
  if (params.length > 4096) {
    throw new Error("Encrypted params must be 4096 characters or fewer.");
  }
  return params;
}
