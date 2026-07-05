import { fetchWithTimeout } from "@shared/utils/fetch-timeout";
import {
  buildConfidentialTransferPackage,
  encryptJsonWithOraclePublicKey,
} from "@shared/utils/morpheus-confidential-envelope";
import { addressToScriptHash } from "@shared/utils/neo";

const MORPHEUS_ENCRYPTION_ALGORITHM = "X25519-HKDF-SHA256-AES-256-GCM";

export type PrivateTransferSealPhase = "key" | "package" | "store";

export interface PreparePrivateTransferInput {
  appId: string;
  network: "mainnet" | "testnet" | string;
  recipient: string;
  amount: string;
  asset?: "GAS" | "NEO" | string;
  memo?: string;
  senderHint?: string;
  fetcher?: typeof fetch;
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

export class PrivateTransferSealError extends Error {
  readonly phase: PrivateTransferSealPhase;

  constructor(phase: PrivateTransferSealPhase, error: unknown) {
    const message = error instanceof Error ? error.message : String(error ?? "Private transfer sealing failed");
    super(message);
    this.name = "PrivateTransferSealError";
    this.phase = phase;
  }
}

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
  const phase = error instanceof PrivateTransferSealError ? error.phase : "package";
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

async function fetchJson(
  fetcher: typeof fetch,
  input: string,
  init?: RequestInit,
): Promise<{ ok: boolean; body: Record<string, unknown> }> {
  const response = fetcher === globalThis.fetch
    ? await fetchWithTimeout(input, init)
    : await fetcher(input, init);
  const body = await response.json().catch(() => ({}));
  return { ok: response.ok, body: body && typeof body === "object" ? body as Record<string, unknown> : {} };
}

export async function preparePrivateTransfer({
  appId,
  network,
  recipient,
  amount,
  asset = "GAS",
  memo = "",
  senderHint,
  fetcher = globalThis.fetch,
}: PreparePrivateTransferInput): Promise<PreparedPrivateTransfer> {
  if (!isValidNeoAddress(recipient) || !isPositiveAssetAmount(amount, asset)) {
    throw new Error("errorMissingInputs");
  }
  if (typeof fetcher !== "function") {
    throw new PrivateTransferSealError("key", "fetch is unavailable");
  }

  let phase: PrivateTransferSealPhase = "key";
  try {
    const key = await fetchJson(
      fetcher,
      `/api/morpheus/oracle/public-key?network=${encodeURIComponent(String(network || "testnet"))}`,
      { headers: { accept: "application/json" } },
    );
    if (!key.ok || !key.body.public_key) {
      throw new Error(String(key.body.error || "Morpheus oracle public key is unavailable"));
    }
    if (key.body.algorithm && key.body.algorithm !== MORPHEUS_ENCRYPTION_ALGORITHM) {
      phase = "package";
      throw new Error(`Unsupported Morpheus encryption algorithm: ${key.body.algorithm}`);
    }

    phase = "package";
    const transferPackage = await buildConfidentialTransferPackage({
      appId,
      network,
      recipient,
      asset,
      amount,
      memo,
      senderHint,
    });
    const ciphertext = await encryptJsonWithOraclePublicKey(
      String(key.body.public_key),
      transferPackage.confidentialPayload,
    );

    phase = "store";
    const stored = await fetchJson(fetcher, "/api/morpheus/confidential/store", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        network,
        target_chain: "neo_n3",
        app_id: appId,
        name: `private-transfer:${transferPackage.publicEnvelope.note_commitment}`,
        ciphertext,
        public_envelope: transferPackage.publicEnvelope,
      }),
    });
    if (!stored.ok || stored.body.inline_fallback) {
      throw new Error(String(stored.body.error || stored.body.message || "Morpheus confidential store is unavailable"));
    }
    const secretRef = String(stored.body.secret_ref || stored.body.id || stored.body.ref || "").trim();
    if (!secretRef) {
      throw new Error("Morpheus confidential store did not return a secret reference");
    }

    return {
      secretRef,
      commitment: transferPackage.publicEnvelope.note_commitment,
      nullifier: transferPackage.publicEnvelope.nullifier_hash,
      network: String(network || "testnet"),
      asset: String(asset || "GAS").toUpperCase(),
      contract: String(key.body.contract || ""),
    };
  } catch (error) {
    if (error instanceof PrivateTransferSealError) throw error;
    throw new PrivateTransferSealError(phase, error);
  }
}
