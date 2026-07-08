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
import { FrameworkSealError } from "@framework/oracle-ext";
import type { FrameworkOracleExtensions, FrameworkSealPhase } from "@framework/oracle-ext";
import { buildConfidentialTransferPackage } from "@shared/utils/morpheus-confidential-envelope";
import { addressToScriptHash } from "@shared/utils/neo";

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
}

export interface PreparedPrivateTransfer {
  secretRef: string;
  commitment: string;
  nullifier: string;
  network: string;
  asset: string;
  contract: string;
}

export type PrivateTransferAsset = "GAS" | "NEO";

// framework-exempt: false-not-throw validators — these validity checks are
// load-bearing for the composer's inline error copy and the disabled-CTA
// gating (PlayArea re-runs them per keystroke); arg.hash160 throws.
export function isValidNeoAddress(value: string): boolean {
  const address = value.trim();
  return address.startsWith("N") && Boolean(addressToScriptHash(address));
}

export function isPositiveAmount(value: string): boolean {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0;
}

export function isPositiveAssetAmount(value: string, asset: string = "GAS"): boolean {
  if (!isPositiveAmount(value)) return false;
  if (String(asset).toUpperCase() !== "NEO") return true;
  return /^[1-9]\d*$/.test(value.trim());
}

export function normalizePrivateTransferErrorKey(error: unknown): string {
  const phase = error instanceof FrameworkSealError ? error.phase : "package";
  const raw = error instanceof Error ? error.message : String(error ?? "");
  if (raw === "errorMissingInputs") {
    return "errorMissingInputs";
  }
  if (phase === "key" || /public key|contract.*configured|not configured|network|404|not found/i.test(raw)) {
    return "sealErrorKey";
  }
  if (/algorithm|X25519|HKDF|AES/i.test(raw)) {
    return "sealErrorAlgorithm";
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
}: PreparePrivateTransferInput): Promise<PreparedPrivateTransfer> {
  if (!isValidNeoAddress(recipient) || !isPositiveAssetAmount(amount, asset)) {
    throw new Error("errorMissingInputs");
  }

  // Phase "key": oracle public-key fetch + encryption-algorithm pinning.
  // Fetched (or cache-served) before the package is built so a dead key
  // endpoint still surfaces as `sealErrorKey`, never as a package error.
  const key = await seal.publicKey();

  // Phase "package": the confidential transfer package is app business
  // logic (note commitment / nullifier derivation), so it is built here —
  // but its failures are tagged with the same phase the framework uses for
  // envelope-encryption errors.
  let transferPackage;
  try {
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
  const { ciphertext } = await seal.encrypt(transferPackage.confidentialPayload);

  // Phase "store": confidential-store submission (secret_ref extraction and
  // inline-fallback rejection happen inside the framework client).
  const stored = await seal.store({
    name: `private-transfer:${transferPackage.publicEnvelope.note_commitment}`,
    ciphertext,
    publicEnvelope: transferPackage.publicEnvelope,
    network,
    appId,
  });

  return {
    secretRef: stored.secretRef,
    commitment: transferPackage.publicEnvelope.note_commitment,
    nullifier: transferPackage.publicEnvelope.nullifier_hash,
    network: String(network || "testnet"),
    asset: String(asset || "GAS").toUpperCase(),
    contract: key.contract,
  };
}
