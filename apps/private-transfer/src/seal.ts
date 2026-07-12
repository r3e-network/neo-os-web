/**
 * seal.ts — Confidential-transfer sealing on the framework seal lane.
 *
 * The Morpheus plumbing (oracle public-key fetch + algorithm pinning,
 * envelope encryption, confidential-store submission) lives in
 * `app.oracle.seal` (framework S13); every failure it raises is a
 * phase-tagged {@link FrameworkSealError} (`key` | `package` | `store`).
 * This module keeps only the app-specific pieces: input validation, the
 * confidential transfer-package builder, and the phase→i18n-key mapping.
 */
import {
  FrameworkSealError,
  MORPHEUS_ENCRYPTION_ALGORITHM,
} from "@framework/oracle-ext";
import type { FrameworkOracleExtensions, FrameworkSealPhase } from "@framework/oracle-ext";
import { ORACLE_CONTRACT_MAINNET } from "@shared/constants";
import { buildConfidentialTransferPackage } from "@shared/utils/morpheus-confidential-envelope";
import { addressToScriptHash } from "@shared/utils/neo";
import {
  PRIVATE_TRANSFER_TESTNET_ORACLE_CONTRACT,
} from "./protocol";

export {
  isMorpheusCiphertextEnvelope,
  PRIVATE_TRANSFER_TESTNET_ORACLE_CONTRACT,
  PRIVATE_TRANSFER_TESTNET_ORACLE_NEF_CHECKSUM,
} from "./protocol";

export type PrivateTransferSealPhase = FrameworkSealPhase;

/**
 * The framework seal lane (`app.oracle.seal`) — public-key fetch,
 * envelope encryption, confidential-store submission.
 */
export type PrivateTransferSealClient = Pick<
  FrameworkOracleExtensions["seal"],
  "publicKey" | "encrypt" | "store"
>;

export interface PreparePrivateTransferInput {
  appId: string;
  network: "mainnet" | "testnet" | string;
  recipient: string;
  amount: string;
  asset?: "GAS" | "NEO" | string;
  memo?: string;
  senderHint?: string;
  seal: PrivateTransferSealClient;
  /** Drives the user-visible, truthful phase rail. */
  onPhase?: (phase: PrivateTransferSealPhase) => void;
  /**
   * Independently verify the freshly fetched endpoint key against its Neo N3
   * contract source immediately before encryption.
   */
  verifyKey?: (key: PrivateTransferOracleKey) => void | Promise<void>;
  /** Called after local encryption and before remote storage. */
  onPrepared?: (prepared: PreparedPrivateTransferEnvelope) => void | Promise<void>;
}

export interface PreparedPrivateTransfer {
  secretRef: string;
  commitment: string;
  nullifier: string;
  network: string;
  asset: string;
  contract: string;
}

/** Exact encrypted packet that can be persisted and retried safely. */
export interface PreparedPrivateTransferEnvelope {
  name: string;
  ciphertext: string;
  publicEnvelope: Record<string, unknown>;
  commitment: string;
  nullifier: string;
  network: string;
  asset: string;
  contract: string;
}

export type PrivateTransferAsset = "GAS" | "NEO";
export type PrivateTransferOracleKey = Awaited<ReturnType<PrivateTransferSealClient["publicKey"]>>;
export type PrivateTransferNetwork = "testnet" | "mainnet" | "unsupported";

// framework-exempt: false-not-throw validators — these validity checks are
// load-bearing for the composer's inline error copy and the disabled-CTA
// gating (PlayArea re-runs them per keystroke); arg.hash160 throws.
export function isValidNeoAddress(value: string): boolean {
  const address = value.trim();
  return address.startsWith("N") && Boolean(addressToScriptHash(address));
}

export function isPositiveAmount(value: string): boolean {
  const amount = value.trim();
  if (amount.length === 0 || amount.length > 64) return false;
  if (!/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(amount)) return false;
  return BigInt(amount.replace(".", "")) > 0n;
}

export function isPositiveAssetAmount(value: string, asset: string = "GAS"): boolean {
  const amount = value.trim();
  const normalizedAsset = String(asset).trim().toUpperCase();
  if (amount.length === 0 || amount.length > 32) return false;
  if (normalizedAsset === "NEO") {
    return /^[1-9]\d{0,8}$/.test(amount) && BigInt(amount) <= 100_000_000n;
  }
  if (normalizedAsset !== "GAS") return false;
  // GAS is fixed8. Reject exponent notation, signs, excess precision, and
  // ambiguous forms such as `.5` before any private payload is built. Keep
  // the integer side aligned with the composer's 16-digit input boundary.
  if (!/^(?:0|[1-9]\d{0,15})(?:\.\d{1,8})?$/.test(amount)) return false;
  return BigInt(amount.replace(".", "")) > 0n;
}

function classifyNetwork(value: unknown): "testnet" | "mainnet" | "generic" | "unsupported" {
  const network = String(value ?? "").trim().toLowerCase();
  if (network === "mainnet" || network === "neo-n3-mainnet") return "mainnet";
  if (network === "testnet" || network === "neo-n3-testnet") return "testnet";
  if (network === "neo-n3") return "generic";
  return "unsupported";
}

/**
 * Resolve the read-only runtime lane without silently treating an explicit
 * mainnet launch, EVM network, or unknown adapter result as testnet.
 */
export function resolvePrivateTransferNetwork(
  detectedNetwork: unknown,
  requestedNetwork?: unknown,
): PrivateTransferNetwork {
  const detected = classifyNetwork(detectedNetwork);
  const requested = classifyNetwork(requestedNetwork);
  const hasRequestedNetwork = String(requestedNetwork ?? "").trim().length > 0;
  if (detected === "mainnet" || requested === "mainnet") return "mainnet";
  if (detected === "testnet") {
    if (!hasRequestedNetwork) return "testnet";
    return requested === "testnet" ? "testnet" : "unsupported";
  }
  if (detected === "generic" && requested === "testnet") return "testnet";
  return "unsupported";
}

function normalizeNetwork(value: string): "mainnet" | "testnet" {
  return String(value || "").toLowerCase().includes("mainnet") ? "mainnet" : "testnet";
}

function expectedOracleContract(network: string): string {
  return normalizeNetwork(network) === "mainnet"
    ? ORACLE_CONTRACT_MAINNET
    : PRIVATE_TRANSFER_TESTNET_ORACLE_CONTRACT;
}

function isRawX25519PublicKey(value: string): boolean {
  try {
    return globalThis.atob(String(value || "")).length === 32;
  } catch {
    return false;
  }
}

function validateFreshOracleKey(
  key: PrivateTransferOracleKey,
  requestedNetwork: string,
): void {
  if (key.stale) {
    throw new FrameworkSealError("key", "Morpheus oracle key refresh returned only stale cache data");
  }
  if (normalizeNetwork(key.network) !== normalizeNetwork(requestedNetwork)) {
    throw new FrameworkSealError("key", "Morpheus oracle key network does not match this intent");
  }
  const pinnedContract = expectedOracleContract(requestedNetwork);
  if (
    !/^0x[0-9a-f]{40}$/i.test(key.contract) ||
    !pinnedContract ||
    key.contract.toLowerCase() !== pinnedContract.toLowerCase()
  ) {
    throw new FrameworkSealError("key", "Morpheus oracle contract source does not match this release");
  }
  if (key.algorithm !== MORPHEUS_ENCRYPTION_ALGORITHM) {
    throw new FrameworkSealError("package", "Morpheus oracle encryption algorithm does not match this release");
  }
  if (!isRawX25519PublicKey(key.publicKey)) {
    throw new FrameworkSealError("key", "Morpheus oracle public key is not a raw 32-byte X25519 key");
  }
}

/** Read-only readiness probe used before enabling a new sealing action. */
export async function probePrivateTransferRuntime({
  network,
  seal,
}: {
  network: string;
  seal: PrivateTransferSealClient;
}) {
  const key = await seal.publicKey({ forceRefresh: true });
  validateFreshOracleKey(key, network);
  return key;
}

/** Compare the endpoint key with the independently read contract value. */
export function assertOracleContractPublicKey(
  endpointKey: PrivateTransferOracleKey,
  contractValue: unknown,
  contractAlgorithm?: unknown,
): void {
  const onChainKey = String(contractValue ?? "").trim();
  const onChainAlgorithm = String(contractAlgorithm ?? "").trim();
  if (
    endpointKey.contract.toLowerCase() !==
    PRIVATE_TRANSFER_TESTNET_ORACLE_CONTRACT.toLowerCase()
  ) {
    throw new FrameworkSealError("key", "Morpheus public key came from an unpinned contract");
  }
  if (!onChainKey || onChainKey !== endpointKey.publicKey) {
    throw new FrameworkSealError("key", "Morpheus public key does not match its Neo N3 contract source");
  }
  if (
    endpointKey.algorithm !== MORPHEUS_ENCRYPTION_ALGORITHM ||
    (onChainAlgorithm && onChainAlgorithm !== MORPHEUS_ENCRYPTION_ALGORITHM)
  ) {
    throw new FrameworkSealError("package", "Morpheus encryption algorithm does not match its Neo N3 contract source");
  }
}

export function normalizePrivateTransferErrorKey(error: unknown): string {
  const phase = error instanceof FrameworkSealError ? error.phase : "package";
  const raw = error instanceof Error ? error.message : String(error ?? "");
  if (raw === "errorMissingInputs") {
    return "errorMissingInputs";
  }
  if (/timeout|timed out|abort/i.test(raw)) {
    return "sealErrorTimeout";
  }
  if (/algorithm|X25519|HKDF|AES/i.test(raw)) {
    return "sealErrorAlgorithm";
  }
  if (phase === "key" || /public key|contract.*configured|not configured|network|404|not found/i.test(raw)) {
    return "sealErrorKey";
  }
  if (phase === "store" || /secret reference|secret_ref|store|inline_fallback/i.test(raw)) {
    return "sealErrorStore";
  }
  return "sealErrorGeneric";
}

export async function preparePrivateTransfer({
  appId,
  network,
  recipient,
  amount,
  asset = "GAS",
  memo = "",
  senderHint,
  seal,
  onPhase,
  verifyKey,
  onPrepared,
}: PreparePrivateTransferInput): Promise<PreparedPrivateTransfer> {
  if (!isValidNeoAddress(recipient) || !isPositiveAssetAmount(amount, asset)) {
    throw new Error("errorMissingInputs");
  }

  // Phase "key": oracle public-key fetch + encryption-algorithm pinning.
  // Fetched (or cache-served) before the package is built so a dead key
  // endpoint still surfaces as `sealErrorKey`, never as a package error.
  onPhase?.("key");
  const key = await probePrivateTransferRuntime({ network, seal });
  try {
    await verifyKey?.(key);
  } catch (error) {
    throw error instanceof FrameworkSealError
      ? error
      : new FrameworkSealError("key", error);
  }

  // Phase "package": the confidential transfer package is app business
  // logic (note commitment / nullifier derivation), so it is built here —
  // but its failures are tagged with the same phase the framework uses for
  // envelope-encryption errors.
  let transferPackage;
  try {
    onPhase?.("package");
    transferPackage = await buildConfidentialTransferPackage({
      appId,
      network,
      recipient,
      asset,
      amount,
      memo,
      senderHint,
    });
  } catch (error) {
    throw error instanceof FrameworkSealError
      ? error
      : new FrameworkSealError("package", error);
  }
  const encrypted = await seal.encrypt(transferPackage.confidentialPayload);
  validateFreshOracleKey(encrypted.key, network);
  if (
    encrypted.key.contract.toLowerCase() !== key.contract.toLowerCase() ||
    encrypted.key.publicKey !== key.publicKey ||
    encrypted.key.algorithm !== key.algorithm
  ) {
    throw new FrameworkSealError("key", "Morpheus oracle key changed while sealing");
  }

  const prepared: PreparedPrivateTransferEnvelope = {
    name: `private-transfer:${transferPackage.publicEnvelope.note_commitment}`,
    ciphertext: encrypted.ciphertext,
    publicEnvelope: transferPackage.publicEnvelope,
    commitment: transferPackage.publicEnvelope.note_commitment,
    nullifier: transferPackage.publicEnvelope.nullifier_hash,
    network: normalizeNetwork(network),
    asset: String(asset || "GAS").toUpperCase(),
    contract: key.contract,
  };
  await onPrepared?.(prepared);

  onPhase?.("store");
  return storePreparedPrivateTransfer({ appId, prepared, seal });
}

/** Retry the exact ciphertext packet; never rebuild a second private intent. */
export async function storePreparedPrivateTransfer({
  appId,
  prepared,
  seal,
}: {
  appId: string;
  prepared: PreparedPrivateTransferEnvelope;
  seal: PrivateTransferSealClient;
}): Promise<PreparedPrivateTransfer> {
  const stored = await seal.store({
    name: prepared.name,
    ciphertext: prepared.ciphertext,
    publicEnvelope: prepared.publicEnvelope,
    network: prepared.network,
    appId,
  });

  const secretRef = String(stored.secretRef || "").trim();
  if (
    !secretRef ||
    secretRef.length > 512 ||
    /[\u0000-\u001f\u007f]/.test(secretRef)
  ) {
    throw new FrameworkSealError("store", "Morpheus confidential store returned an invalid secret reference");
  }

  return {
    secretRef,
    commitment: prepared.commitment,
    nullifier: prepared.nullifier,
    network: prepared.network,
    asset: prepared.asset,
    contract: prepared.contract,
  };
}
