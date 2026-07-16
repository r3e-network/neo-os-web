/**
 * Pure AA (abstract-account) derivation helpers.
 *
 * Canonical home of the helpers formerly living in
 * apps/shared/utils/aa-account.ts (S10 app.aa extraction) — shared
 * re-exports from here so existing `@shared/utils/aa-account` imports keep
 * resolving to the SAME function identities.
 *
 * Everything in this module is wallet-free and deterministic: registration
 * account-id derivation (UnifiedSmartWallet V3 vector-compatible), Custom
 * Anchor agent derivation, and session key-pair generation.
 */
import { ripemd160 } from "@noble/hashes/ripemd160";
import { sha256 } from "@noble/hashes/sha256";
import { p256 } from "@noble/curves/p256";
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

export type AppAccountHashInput = {
  /** The mint transaction's sender: Neo N3 address or display-order 0x Hash160. */
  deployerSender: string;
  /** The canonical AppAccount NEF checksum (uint32, little-endian tail of the .nef). */
  nefChecksum: number;
  /** The spliced manifest name — the registry uses the appId (1–64 chars). */
  manifestName: string;
};

/** NeoVM opcodes used by the CreateContractHash preimage script. */
const NEOVM_ABORT = 0x38;
const NEOVM_PUSHDATA1 = 0x0c;
const NEOVM_PUSHDATA2 = 0x0d;
const NEOVM_PUSH0 = 0x10;
const NEOVM_PUSHINT_OPCODES: ReadonlyArray<{ opcode: number; width: number }> = [
  { opcode: 0x00, width: 1 }, // PUSHINT8
  { opcode: 0x01, width: 2 }, // PUSHINT16
  { opcode: 0x02, width: 4 }, // PUSHINT32
  { opcode: 0x03, width: 8 }, // PUSHINT64
];

/**
 * NeoVM integer push (ScriptBuilder.EmitPush(BigInteger)) for a uint32 NEF
 * checksum: 0–16 collapse to a single PUSH<n> opcode; larger values emit the
 * minimal signed little-endian bytes — appending a 0x00 sign byte when the
 * top bit is set, so e.g. 0xffffffff widens past PUSHINT32 into PUSHINT64 —
 * zero-padded to the encoding width.
 */
function emitChecksumPush(checksum: number): number[] {
  if (!Number.isInteger(checksum) || checksum < 0 || checksum > 0xffffffff) {
    throw new Error("nefChecksum must be a uint32 value");
  }
  if (checksum <= 16) return [NEOVM_PUSH0 + checksum];
  const bytes: number[] = [];
  let remaining = checksum;
  while (remaining > 0) {
    bytes.push(remaining & 0xff);
    remaining = Math.floor(remaining / 256);
  }
  if ((bytes[bytes.length - 1] & 0x80) !== 0) bytes.push(0x00);
  const encoding = NEOVM_PUSHINT_OPCODES.find(({ width }) => bytes.length <= width);
  if (!encoding) throw new Error("nefChecksum must be a uint32 value");
  while (bytes.length < encoding.width) bytes.push(0x00);
  return [encoding.opcode, ...bytes];
}

/** NeoVM data push (ScriptBuilder.EmitPush(byte[])) for preimage payloads. */
function emitDataPush(data: Uint8Array): number[] {
  if (data.length < 0x100) return [NEOVM_PUSHDATA1, data.length, ...data];
  if (data.length < 0x10000) {
    return [NEOVM_PUSHDATA2, data.length & 0xff, (data.length >> 8) & 0xff, ...data];
  }
  throw new Error("manifest name payload exceeds NeoVM PUSHDATA2 range");
}

/**
 * ADVISORY Neo N3 `CreateContractHash` derivation for registry-minted
 * AppAccounts (platform-contract-library-v2 §4.1 rule 4):
 * `hash160(ABORT ‖ PUSHDATA(sender) ‖ PUSHINT(nefChecksum) ‖ PUSHDATA(name))`
 * — byte-exact with neo-core `Helper.GetContractHash`, pinned by the shared
 * vector fixture `contracts/__tests__/fixtures/create-contract-hash-vectors.json`
 * whose measured row comes from the in-engine deploy measurement
 * (`PlatformRegistryHashSemanticsTests`).
 *
 * `deployerSender` is the MINT TRANSACTION'S SENDER — measured fact: a
 * contract-initiated `ContractManagement.Deploy` folds the transaction
 * sender, not the calling contract, into the hash. So this prediction only
 * holds when minting routes through a known fixed sender (the platform
 * pipeline deployer).
 *
 * Advisory-only, per §4.1 rules 2–3: the PlatformRegistry row records the
 * ACTUAL post-deploy hash and is the address-of-record; never publish a
 * predicted address before materialization, and never fund one — funds flow
 * only after the registry row exists.
 */
export function deriveAppAccountHash(input: AppAccountHashInput): string {
  const name = String(input.manifestName ?? "");
  if (name.length < 1 || name.length > 64) {
    throw new Error("manifest name must be 1-64 characters (the registry appId rule)");
  }
  const senderDisplayHex = normalizeRegistrationHash160(input.deployerSender, "deployer sender");
  const senderLittleEndian = hexToBytes(senderDisplayHex).reverse();
  const script = Uint8Array.from([
    NEOVM_ABORT,
    ...emitDataPush(senderLittleEndian),
    ...emitChecksumPush(input.nefChecksum),
    ...emitDataPush(new TextEncoder().encode(name)),
  ]);
  const hashLittleEndian = ripemd160(sha256(script));
  return `0x${bytesToHex(Uint8Array.from(hashLittleEndian).reverse())}`;
}

export function generateAASessionKeyPair(): { privateKey: string; publicKey: string } {
  const privateKey = p256.utils.randomPrivateKey();
  const publicKey = p256.getPublicKey(privateKey, true);
  return {
    privateKey: bytesToHex(privateKey),
    publicKey: bytesToHex(publicKey),
  };
}
