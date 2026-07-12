import { MORPHEUS_ENCRYPTION_ALGORITHM } from "@framework/oracle-ext";
import { ORACLE_CONTRACT_TESTNET } from "@shared/constants";

/** Release-pinned runtime identity, mirrored by the generated Morpheus registry. */
export const PRIVATE_TRANSFER_TESTNET_ORACLE_CONTRACT = ORACLE_CONTRACT_TESTNET;

/** Read-only TestNet deployment evidence captured on 2026-07-11. */
export const PRIVATE_TRANSFER_TESTNET_ORACLE_NEF_CHECKSUM = 785_941_005;

function decodedBase64Length(value: unknown): number | null {
  const encoded = String(value ?? "");
  if (!encoded || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) return null;
  try {
    return globalThis.atob(encoded).length;
  } catch {
    return null;
  }
}

/** Validate a recovery packet as the exact framework v2 ciphertext envelope. */
export function isMorpheusCiphertextEnvelope(value: unknown): boolean {
  if (typeof value !== "string" || value.length === 0 || value.length > 1_000_000) {
    return false;
  }
  try {
    const decoded = globalThis.atob(value);
    const envelope = JSON.parse(decoded) as Record<string, unknown>;
    return (
      envelope.v === 2 &&
      envelope.alg === MORPHEUS_ENCRYPTION_ALGORITHM &&
      decodedBase64Length(envelope.epk) === 32 &&
      decodedBase64Length(envelope.iv) === 12 &&
      (decodedBase64Length(envelope.ct) ?? 0) > 0 &&
      decodedBase64Length(envelope.tag) === 16
    );
  } catch {
    return false;
  }
}
