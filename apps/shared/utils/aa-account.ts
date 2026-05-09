import { ripemd160 } from "../shims/noble-hashes-ripemd160.js";
import { sha256 } from "../shims/noble-hashes-sha256.js";
import { p256 } from "../shims/noble-curves-p256.js";
import { addressToScriptHash, normalizeScriptHash } from "./neo";

export const AA_REGISTRATION_ESCAPE_TIMELOCK_SECONDS = 30 * 24 * 60 * 60;
export const AA_REGISTRATION_MIN_ESCAPE_TIMELOCK_SECONDS = 7 * 24 * 60 * 60;
export const AA_REGISTRATION_MAX_ESCAPE_TIMELOCK_SECONDS = 90 * 24 * 60 * 60;

export type RegistrationAccountOptions = {
  verifierContractHash?: string;
  verifierParamsHex?: string;
  hookContractHash?: string;
  backupOwnerAddress: string;
  escapeTimelock?: number;
};

export type AnchorAgentDerivationOptions = {
  seedPrefix: string;
  appId: string;
  nonce: string;
  backupOwnerAddress: string;
  verifierContractHash?: string;
  hookContractHash?: string;
  escapeTimelock?: number;
  count?: number;
};

export type AnchorAgentAccount = {
  agentId: number;
  verifierParams: string;
  verifierParamsHex: string;
  accountIdHash: string;
  accountId: string;
};

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function sanitizeHex(value: string, label = "hex"): string {
  const normalized = String(value || "").trim().replace(/^0x/i, "").toLowerCase();
  if (normalized.length % 2 !== 0 || !/^[0-9a-f]*$/i.test(normalized)) {
    throw new Error(`${label} must be valid hex`);
  }
  return normalized;
}

function hexToBytes(hexValue: string): Uint8Array {
  const hex = sanitizeHex(hexValue);
  const output = new Uint8Array(hex.length / 2);
  for (let index = 0; index < hex.length; index += 2) {
    output[index / 2] = Number.parseInt(hex.slice(index, index + 2), 16);
  }
  return output;
}

function stringToHex(value: string): string {
  return bytesToHex(new TextEncoder().encode(value));
}

function hash160HexFromHex(hexValue: string): string {
  return bytesToHex(ripemd160(sha256(hexToBytes(hexValue))));
}

function validateEscapeTimelock(value: number): void {
  if (!Number.isInteger(value) || value < 0 || value > 0xffffffff) {
    throw new Error("escape timelock must be a uint32 value");
  }
  if (
    value < AA_REGISTRATION_MIN_ESCAPE_TIMELOCK_SECONDS ||
    value > AA_REGISTRATION_MAX_ESCAPE_TIMELOCK_SECONDS
  ) {
    throw new Error("escape timelock must be between 7 and 90 days");
  }
}

function toUint32LittleEndianHex(value: number): string {
  validateEscapeTimelock(value);
  return [
    value & 0xff,
    (value >>> 8) & 0xff,
    (value >>> 16) & 0xff,
    (value >>> 24) & 0xff,
  ].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function normalizeRegistrationHash160(value: string | undefined, label: string, zeroWhenEmpty = false): string {
  const trimmed = String(value || "").trim();
  if (!trimmed && zeroWhenEmpty) return "00".repeat(20);
  const hash = trimmed.startsWith("N") && trimmed.length === 34
    ? addressToScriptHash(trimmed).replace(/^0x/i, "")
    : trimmed.replace(/^0x/i, "");
  if (!/^[0-9a-f]{40}$/i.test(hash)) {
    throw new Error(`${label} must be a Neo address or 20-byte script hash`);
  }
  return hash.toLowerCase();
}

export function deriveAAAccountIdHash(input: string): string {
  const trimmed = String(input || "").trim();
  const normalized = normalizeScriptHash(trimmed).replace(/^0x/, "");
  if (/^[0-9a-f]{40}$/i.test(normalized)) return normalized.toLowerCase();
  if (!trimmed) {
    throw new Error("accountId seed is required");
  }
  const seed = new TextEncoder().encode(trimmed);
  return bytesToHex(ripemd160(sha256(seed)));
}

export function deriveRegistrationAccountIdHash(options: RegistrationAccountOptions): string {
  const escapeTimelock = options.escapeTimelock ?? AA_REGISTRATION_ESCAPE_TIMELOCK_SECONDS;
  const backupOwner = normalizeRegistrationHash160(options.backupOwnerAddress, "backup owner");
  const verifierHash = normalizeRegistrationHash160(options.verifierContractHash, "verifier contract hash", true);
  const hookHash = normalizeRegistrationHash160(options.hookContractHash, "hook contract hash", true);
  const verifierParams = sanitizeHex(options.verifierParamsHex || "", "verifier params");

  return hash160HexFromHex([
    "aa524701",
    backupOwner,
    verifierHash,
    hookHash,
    toUint32LittleEndianHex(escapeTimelock),
    verifierParams,
  ].join(""));
}

export function buildAnchorAgentVerifierParam({
  seedPrefix,
  appId,
  agentId,
  nonce,
}: {
  seedPrefix: string;
  appId: string;
  agentId: number;
  nonce: string;
}): string {
  const prefix = String(seedPrefix || "").trim();
  const anchorAppId = String(appId || "").trim();
  const nonceValue = String(nonce || "").trim();
  if (!prefix) throw new Error("anchor seed prefix is required");
  if (!anchorAppId) throw new Error("anchor app id is required");
  if (!nonceValue) throw new Error("anchor nonce is required");
  if (!Number.isInteger(agentId) || agentId < 1 || agentId > 21) {
    throw new Error("anchor agent id must be between 1 and 21");
  }
  return `anchor:${prefix}:app:${anchorAppId}:agent:${String(agentId).padStart(2, "0")}:nonce:${nonceValue}`;
}

export function deriveAnchorAgentAccounts(options: AnchorAgentDerivationOptions): AnchorAgentAccount[] {
  const count = options.count ?? 21;
  if (!Number.isInteger(count) || count < 1 || count > 21) {
    throw new Error("anchor agent count must be between 1 and 21");
  }

  return Array.from({ length: count }, (_, index) => {
    const agentId = index + 1;
    const verifierParams = buildAnchorAgentVerifierParam({
      seedPrefix: options.seedPrefix,
      appId: options.appId,
      agentId,
      nonce: options.nonce,
    });
    const verifierParamsHex = stringToHex(verifierParams);
    const accountIdHash = deriveRegistrationAccountIdHash({
      verifierContractHash: options.verifierContractHash,
      verifierParamsHex,
      hookContractHash: options.hookContractHash,
      backupOwnerAddress: options.backupOwnerAddress,
      escapeTimelock: options.escapeTimelock,
    });

    return {
      agentId,
      verifierParams,
      verifierParamsHex,
      accountIdHash,
      accountId: `0x${accountIdHash}`,
    };
  });
}

export function generateAASessionKeyPair(): { privateKey: string; publicKey: string } {
  const privateKey = p256.utils.randomPrivateKey();
  const publicKey = p256.getPublicKey(privateKey, true);
  return {
    privateKey: bytesToHex(privateKey),
    publicKey: bytesToHex(publicKey),
  };
}
