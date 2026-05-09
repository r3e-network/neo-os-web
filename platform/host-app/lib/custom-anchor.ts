import type { InvokeParams } from "@/lib/wallet/adapters/base";
import { addressToScriptHash } from "@/lib/chain";
import { ripemd160 } from "@noble/hashes/ripemd160.js";
import { sha256 } from "@noble/hashes/sha2.js";

const ZERO_HASH160 = "0x0000000000000000000000000000000000000000";
const DEFAULT_ESCAPE_TIMELOCK_SECONDS = 30 * 24 * 60 * 60;

export type CustomAnchorMode = "trust" | "profit";

export type AnchorAgentAccount = {
  agentId: number;
  verifierParams: string;
  verifierParamsHex: string;
  accountIdHash: string;
  accountId: string;
};

export type CustomAnchorRegistrationPlan = {
  appId: string;
  mode: 1 | 2;
  agents: AnchorAgentAccount[];
  invocations: InvokeParams[];
};

export function buildCustomAnchorAppId(slug: string, nonce: string): string {
  const safeSlug = normalizeAnchorSegment(slug, "anchor slug", 24);
  const safeNonce = normalizeAnchorSegment(nonce, "anchor nonce", 24);
  return `custom-anchor:${safeSlug}:${safeNonce}`;
}

export function parseAnchorCandidateKeys(value: string): string[] {
  const keys = String(value || "")
    .split(/[\s,;]+/)
    .map((item) => item.trim())
    .filter(Boolean);
  if (keys.length !== 21) {
    throw new Error("Custom Anchor requires exactly 21 council candidate public keys.");
  }
  const seen = new Set<string>();
  for (const key of keys) {
    if (!/^(02|03)[0-9a-fA-F]{64}$/.test(key)) {
      throw new Error("Each candidate must be a compressed public key.");
    }
    const normalized = key.toLowerCase();
    if (seen.has(normalized)) {
      throw new Error("Candidate public keys must be unique.");
    }
    seen.add(normalized);
  }
  return keys;
}

export function buildCustomAnchorRegistrationPlan({
  anchorContractHash,
  aaCoreHash,
  ownerAddress,
  slug,
  nonce,
  mode,
  candidateKeys,
}: {
  anchorContractHash: string;
  aaCoreHash: string;
  ownerAddress: string;
  slug: string;
  nonce: string;
	  mode: unknown;
  candidateKeys: string[];
}): CustomAnchorRegistrationPlan {
  if (!/^0x[0-9a-fA-F]{40}$/.test(anchorContractHash)) {
    throw new Error("PlatformAnchor contract hash is not configured.");
  }
  if (!/^0x[0-9a-fA-F]{40}$/.test(aaCoreHash)) {
    throw new Error("AA core contract hash is not configured.");
  }
  if (!String(ownerAddress || "").trim()) {
    throw new Error("Connect wallet before registering a Custom Anchor.");
  }
  if (candidateKeys.length !== 21) {
    throw new Error("Custom Anchor requires exactly 21 council candidate public keys.");
  }

  const appId = buildCustomAnchorAppId(slug, nonce);
  const numericMode = normalizeMode(mode);
  const seedPrefix = normalizeAnchorSegment(slug, "anchor slug", 24);
  const ownerHash = `0x${normalizeHash160(ownerAddress, "owner")}`;
  const agents = deriveAnchorAgentAccounts(seedPrefix, appId, nonce, ownerHash);

  return {
    appId,
    mode: numericMode,
    agents,
    invocations: [
      {
        scriptHash: aaCoreHash,
        operation: "registerAccounts",
        args: [
          {
            type: "Array",
            value: agents.map((agent) => ({ type: "Hash160", value: agent.accountId })),
          },
          { type: "Hash160", value: ZERO_HASH160 },
          {
            type: "Array",
            value: agents.map((agent) => ({ type: "ByteArray", value: agent.verifierParamsHex })),
          },
          { type: "Hash160", value: ZERO_HASH160 },
          { type: "Hash160", value: ownerHash },
          { type: "Integer", value: String(DEFAULT_ESCAPE_TIMELOCK_SECONDS) },
        ],
      },
      {
        scriptHash: anchorContractHash,
        operation: "registerCustomAnchorApp",
        args: [
          { type: "String", value: appId },
          { type: "Integer", value: String(numericMode) },
          { type: "Hash160", value: ownerHash },
        ],
      },
      {
        scriptHash: anchorContractHash,
        operation: "registerAgents",
        args: [
          { type: "String", value: appId },
          {
            type: "Array",
            value: agents.map((agent) => ({ type: "Hash160", value: agent.accountId })),
          },
          {
            type: "Array",
            value: candidateKeys.map((candidate) => ({ type: "PublicKey", value: candidate })),
          },
          {
            type: "Array",
            value: agents.map((agent) => ({ type: "ByteArray", value: agent.accountIdHash })),
          },
        ],
      },
    ],
  };
}

function normalizeMode(mode: unknown): 1 | 2 {
  const raw = String(mode || "").trim().toLowerCase();
  if (raw === "1" || raw === "trust") return 1;
  if (raw === "2" || raw === "profit") return 2;
  throw new Error("Custom Anchor mode must be Trust or Profit.");
}

function deriveAnchorAgentAccounts(
  seedPrefix: string,
  appId: string,
  nonce: string,
  ownerAddress: string,
): AnchorAgentAccount[] {
  return Array.from({ length: 21 }, (_, index) => {
    const agentId = index + 1;
    const verifierParams = `anchor:${seedPrefix}:app:${appId}:agent:${String(agentId).padStart(2, "0")}:nonce:${nonce}`;
    const verifierParamsHex = stringToHex(verifierParams);
    const accountIdHash = deriveRegistrationAccountIdHash({
      backupOwnerAddress: ownerAddress,
      verifierParamsHex,
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

function deriveRegistrationAccountIdHash({
  backupOwnerAddress,
  verifierParamsHex,
}: {
  backupOwnerAddress: string;
  verifierParamsHex: string;
}): string {
  const backupOwner = normalizeHash160(backupOwnerAddress, "backup owner");
  const payload = [
    "aa524701",
    backupOwner,
    "00".repeat(20),
    "00".repeat(20),
    toUint32LittleEndianHex(DEFAULT_ESCAPE_TIMELOCK_SECONDS),
    sanitizeHex(verifierParamsHex, "verifier params"),
  ].join("");
  return bytesToHex(ripemd160(sha256(hexToBytes(payload))));
}

function normalizeHash160(value: string, label: string): string {
  const scriptHash = addressToScriptHash(value).replace(/^0x/i, "");
  if (!/^[0-9a-f]{40}$/i.test(scriptHash)) {
    throw new Error(`${label} must be a Neo address or 20-byte script hash.`);
  }
  return scriptHash.toLowerCase();
}

function sanitizeHex(value: string, label = "hex"): string {
  const hex = String(value || "").trim().replace(/^0x/i, "").toLowerCase();
  if (hex.length % 2 !== 0 || !/^[0-9a-f]*$/i.test(hex)) {
    throw new Error(`${label} must be valid hex.`);
  }
  return hex;
}

function hexToBytes(hexValue: string): Uint8Array {
  const hex = sanitizeHex(hexValue);
  const output = new Uint8Array(hex.length / 2);
  for (let index = 0; index < hex.length; index += 2) {
    output[index / 2] = Number.parseInt(hex.slice(index, index + 2), 16);
  }
  return output;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function stringToHex(value: string): string {
  return Array.from(value, (char) =>
    char.charCodeAt(0).toString(16).padStart(2, "0"),
  ).join("");
}

function toUint32LittleEndianHex(value: number): string {
  return [
    value & 0xff,
    (value >>> 8) & 0xff,
    (value >>> 16) & 0xff,
    (value >>> 24) & 0xff,
  ].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function normalizeAnchorSegment(value: string, label: string, maxLength: number): string {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength);
  if (!normalized) throw new Error(`${label} is required.`);
  return normalized;
}
