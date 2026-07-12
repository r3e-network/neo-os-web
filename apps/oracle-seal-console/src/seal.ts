import {
  FrameworkSealError,
  MORPHEUS_ENCRYPTION_ALGORITHM,
  type FrameworkSealPublicKey,
  type FrameworkSealStoreInput,
  type FrameworkSealStoreResult,
} from "@framework/oracle-ext";
import {
  EXTERNAL_INTEGRATIONS,
  resolveNeoNetwork,
  type NeoNetwork,
} from "@shared/constants/rpc";

export const ORACLE_SEAL_APP_ID = "miniapp-oracle-seal-console";
export const ORACLE_SEAL_PACKET_KIND = "miniapp.oracle_seal.packet.v1";
export const ORACLE_SEAL_PAYLOAD_KIND = "miniapp.oracle_seal.payload.v1";
export const MAX_SEAL_PAYLOAD_BYTES = 64 * 1024;
export const MAX_PUBLIC_ROUTE_LENGTH = 160;
export const MAX_SEAL_CIPHERTEXT_CHARS = 256 * 1024;
export const MAX_SEAL_JSON_DEPTH = 64;

export const ORACLE_SEAL_PURPOSES = [
  "oracle-input",
  "callback-secret",
  "private-compute",
] as const;

export type OracleSealPurpose = (typeof ORACLE_SEAL_PURPOSES)[number];
export type OracleSealPhase = "key" | "encrypt" | "store";

export interface OracleSealClient {
  publicKey(options?: { forceRefresh?: boolean }): Promise<FrameworkSealPublicKey>;
  encrypt(payload: unknown): Promise<{
    ciphertext: string;
    key: FrameworkSealPublicKey;
  }>;
  store(input: FrameworkSealStoreInput): Promise<FrameworkSealStoreResult>;
}

export interface OracleSealDraft {
  purpose: string;
  publicRoute?: string;
  payload: string;
}

export interface OracleSealPublicEnvelope extends Record<string, unknown> {
  kind: typeof ORACLE_SEAL_PACKET_KIND;
  app_id: typeof ORACLE_SEAL_APP_ID;
  target_chain: "neo_n3";
  network: NeoNetwork;
  purpose: OracleSealPurpose;
  public_route: string | null;
  ciphertext_fingerprint: string;
  encryption_algorithm: typeof MORPHEUS_ENCRYPTION_ALGORITHM;
  oracle_contract: string;
}

export interface PreparedOracleSeal {
  name: string;
  ciphertext: string;
  publicEnvelope: OracleSealPublicEnvelope;
  fingerprint: string;
  purpose: OracleSealPurpose;
  publicRoute: string;
  network: NeoNetwork;
  contract: string;
  algorithm: typeof MORPHEUS_ENCRYPTION_ALGORITHM;
  keyFetchedAt: number;
}

export interface StoredOracleSealReceipt {
  secretRef: string;
  fingerprint: string;
  purpose: OracleSealPurpose;
  publicRoute: string;
  network: NeoNetwork;
  contract: string;
  algorithm: typeof MORPHEUS_ENCRYPTION_ALGORITHM;
}

export interface PrepareOracleSealInput extends OracleSealDraft {
  appId?: string;
  network: NeoNetwork;
  seal: OracleSealClient;
  verifyKey?: (key: FrameworkSealPublicKey) => void | Promise<void>;
  onPhase?: (phase: OracleSealPhase) => void;
  onPrepared?: (prepared: PreparedOracleSeal) => void | Promise<void>;
}

export type OracleSealErrorKey =
  | "sealErrorInput"
  | "sealErrorTooLarge"
  | "sealErrorKey"
  | "sealErrorAlgorithm"
  | "sealErrorEncrypt"
  | "sealErrorService"
  | "sealErrorStore"
  | "sealErrorStorage"
  | "sealErrorTimeout"
  | "sealErrorGeneric";

export class OracleSealInputError extends Error {
  readonly reason: "invalid" | "too_large";

  constructor(reason: "invalid" | "too_large", message: string) {
    super(message);
    this.name = "OracleSealInputError";
    this.reason = reason;
  }
}

function decodedBase64Length(value: unknown): number | null {
  const encoded = String(value ?? "");
  if (!encoded || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) return null;
  try {
    return globalThis.atob(encoded).length;
  } catch {
    return null;
  }
}

function isSafeRoute(value: string): boolean {
  return value.length <= MAX_PUBLIC_ROUTE_LENGTH && !/[\u0000-\u001f\u007f]/.test(value);
}

function isPurpose(value: unknown): value is OracleSealPurpose {
  return ORACLE_SEAL_PURPOSES.includes(value as OracleSealPurpose);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function bytesOf(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

function hasSafeJsonShape(root: unknown): boolean {
  const pending: Array<{ value: unknown; depth: number }> = [{ value: root, depth: 1 }];
  while (pending.length > 0) {
    const current = pending.pop()!;
    if (current.depth > MAX_SEAL_JSON_DEPTH) return false;
    if (typeof current.value === "number") {
      if (!Number.isFinite(current.value)) return false;
      if (Number.isInteger(current.value) && !Number.isSafeInteger(current.value)) return false;
      continue;
    }
    if (!current.value || typeof current.value !== "object") continue;
    const children = Array.isArray(current.value)
      ? current.value
      : Object.values(current.value as Record<string, unknown>);
    for (const value of children) pending.push({ value, depth: current.depth + 1 });
  }
  return true;
}

export function inspectOracleSealPayload(value: string): {
  valid: boolean;
  tooLarge: boolean;
  bytes: number;
} {
  const normalized = String(value ?? "").trim();
  const bytes = bytesOf(normalized);
  if (bytes > MAX_SEAL_PAYLOAD_BYTES) return { valid: false, tooLarge: true, bytes };
  if (!normalized) return { valid: false, tooLarge: false, bytes };
  try {
    const parsed = JSON.parse(normalized);
    const valid = isRecord(parsed)
      && Object.keys(parsed).length > 0
      && hasSafeJsonShape(parsed);
    return { valid, tooLarge: false, bytes };
  } catch {
    return { valid: false, tooLarge: false, bytes };
  }
}

function parseDraft(draft: OracleSealDraft): {
  purpose: OracleSealPurpose;
  publicRoute: string;
  parsedPayload: Record<string, unknown>;
} {
  const purpose = String(draft.purpose || "").trim();
  const publicRoute = String(draft.publicRoute || "").trim();
  const payload = String(draft.payload || "").trim();
  const inspection = inspectOracleSealPayload(payload);

  if (!isPurpose(purpose) || !isSafeRoute(publicRoute) || (!inspection.valid && !inspection.tooLarge)) {
    throw new OracleSealInputError("invalid", "A valid purpose and JSON object are required");
  }
  if (inspection.tooLarge) {
    throw new OracleSealInputError("too_large", "The confidential JSON payload exceeds 64 KiB");
  }

  let parsedPayload: unknown;
  try {
    parsedPayload = JSON.parse(payload);
  } catch {
    throw new OracleSealInputError("invalid", "The confidential payload must be valid JSON");
  }
  if (!isRecord(parsedPayload) || Object.keys(parsedPayload).length === 0 || !hasSafeJsonShape(parsedPayload)) {
    throw new OracleSealInputError("invalid", "The confidential payload must be a non-empty JSON object");
  }

  return { purpose, publicRoute, parsedPayload };
}

/** Validate the framework v2 X25519/HKDF/AES-GCM envelope before persistence. */
export function isMorpheusCiphertextEnvelope(value: unknown): value is string {
  if (
    typeof value !== "string"
    || value.length === 0
    || value.length > MAX_SEAL_CIPHERTEXT_CHARS
  ) {
    return false;
  }
  try {
    const decoded = globalThis.atob(value);
    const envelope = JSON.parse(decoded) as Record<string, unknown>;
    const keys = Object.keys(envelope);
    const expectedKeys = ["v", "alg", "epk", "iv", "ct", "tag"];
    return (
      keys.length === expectedKeys.length &&
      keys.every((key) => expectedKeys.includes(key)) &&
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

/** A real SHA-256 fingerprint of the exact ciphertext packet, never a preview ID. */
export async function ciphertextFingerprint(ciphertext: string): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new FrameworkSealError("package", "WebCrypto SHA-256 is unavailable");
  }
  const digest = await subtle.digest("SHA-256", new TextEncoder().encode(ciphertext));
  return `0x${Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

export function expectedOracleContract(networkInput: string): string {
  const network = resolveNeoNetwork(networkInput);
  return EXTERNAL_INTEGRATIONS[network].contracts.morpheusOracle.toLowerCase();
}

/** Fail closed on stale, cross-network, unpinned, malformed, or wrong-algorithm keys. */
export function validateOracleSealKey(
  key: FrameworkSealPublicKey,
  networkInput: string,
): FrameworkSealPublicKey {
  const network = resolveNeoNetwork(networkInput);
  const contract = String(key.contract || "").trim().toLowerCase();
  if (key.stale) {
    throw new FrameworkSealError("key", "A stale Morpheus encryption key cannot authorize a new seal");
  }
  if (key.network !== network) {
    throw new FrameworkSealError("key", "Morpheus encryption key network mismatch");
  }
  if (contract !== expectedOracleContract(network)) {
    throw new FrameworkSealError("key", "Morpheus encryption key came from an unpinned contract");
  }
  if (key.algorithm !== MORPHEUS_ENCRYPTION_ALGORITHM) {
    throw new FrameworkSealError("package", "Morpheus encryption algorithm mismatch");
  }
  if (decodedBase64Length(key.publicKey) !== 32) {
    throw new FrameworkSealError("key", "Morpheus encryption key must be a raw 32-byte X25519 key");
  }
  if (!Number.isSafeInteger(key.fetchedAt) || key.fetchedAt <= 0) {
    throw new FrameworkSealError("key", "Morpheus encryption key has no valid fetch time");
  }
  return key;
}

export function assertOracleContractEvidence(
  endpointKey: FrameworkSealPublicKey,
  contractKey: unknown,
  contractAlgorithm: unknown,
  networkInput: string,
): void {
  validateOracleSealKey(endpointKey, networkInput);
  if (String(contractKey ?? "").trim() !== endpointKey.publicKey) {
    throw new FrameworkSealError("key", "Morpheus endpoint key does not match the Neo N3 contract");
  }
  if (String(contractAlgorithm ?? "").trim() !== MORPHEUS_ENCRYPTION_ALGORITHM) {
    throw new FrameworkSealError("package", "Neo N3 contract encryption algorithm mismatch");
  }
}

function validFingerprint(value: unknown): value is string {
  return typeof value === "string" && /^0x[0-9a-f]{64}$/i.test(value);
}

export function isPreparedOracleSeal(value: unknown): value is PreparedOracleSeal {
  if (!isRecord(value)) return false;
  const envelope = value.publicEnvelope;
  if (!isRecord(envelope)) return false;
  const allowedEnvelopeKeys = new Set([
    "kind",
    "app_id",
    "target_chain",
    "network",
    "purpose",
    "public_route",
    "ciphertext_fingerprint",
    "encryption_algorithm",
    "oracle_contract",
  ]);
  const route = String(value.publicRoute ?? "");
  const network = value.network;
  const purpose = value.purpose;
  const contract = String(value.contract ?? "").toLowerCase();
  const fingerprint = value.fingerprint;
  return (
    isMorpheusCiphertextEnvelope(value.ciphertext) &&
    validFingerprint(fingerprint) &&
    value.name === `oracle-seal:${fingerprint.slice(2, 26)}` &&
    isPurpose(purpose) &&
    isSafeRoute(route) &&
    (network === "mainnet" || network === "testnet") &&
    contract === expectedOracleContract(network) &&
    value.algorithm === MORPHEUS_ENCRYPTION_ALGORITHM &&
    typeof value.keyFetchedAt === "number" &&
    Number.isSafeInteger(value.keyFetchedAt) &&
    value.keyFetchedAt > 0 &&
    Object.keys(envelope).length === allowedEnvelopeKeys.size &&
    Object.keys(envelope).every((key) => allowedEnvelopeKeys.has(key)) &&
    envelope.kind === ORACLE_SEAL_PACKET_KIND &&
    envelope.app_id === ORACLE_SEAL_APP_ID &&
    envelope.target_chain === "neo_n3" &&
    envelope.network === network &&
    envelope.purpose === purpose &&
    envelope.public_route === (route || null) &&
    envelope.ciphertext_fingerprint === fingerprint &&
    envelope.encryption_algorithm === MORPHEUS_ENCRYPTION_ALGORITHM &&
    String(envelope.oracle_contract ?? "").toLowerCase() === contract
  );
}

function validSecretRef(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const reference = value.trim();
  return (
    reference.length > 0 &&
    reference.length <= 512 &&
    !/[\u0000-\u001f\u007f]/.test(reference) &&
    !/^(?:0x)?0+$/i.test(reference) &&
    !/^(?:null|undefined)$/i.test(reference)
  );
}

/** Retry/store the exact prepared ciphertext; this function never encrypts again. */
export async function storePreparedOracleSeal({
  appId = ORACLE_SEAL_APP_ID,
  prepared,
  seal,
}: {
  appId?: string;
  prepared: PreparedOracleSeal;
  seal: OracleSealClient;
}): Promise<StoredOracleSealReceipt> {
  if (!isPreparedOracleSeal(prepared)) {
    throw new FrameworkSealError("store", "The recoverable ciphertext packet is invalid");
  }
  const actualFingerprint = await ciphertextFingerprint(prepared.ciphertext);
  if (actualFingerprint !== prepared.fingerprint) {
    throw new FrameworkSealError("store", "The recoverable ciphertext fingerprint does not match");
  }
  const stored = await seal.store({
    name: prepared.name,
    ciphertext: prepared.ciphertext,
    publicEnvelope: prepared.publicEnvelope,
    network: prepared.network,
    appId,
    targetChain: "neo_n3",
  });
  if (!validSecretRef(stored.secretRef)) {
    throw new FrameworkSealError("store", "Morpheus confidential store returned an invalid secret reference");
  }
  return {
    secretRef: stored.secretRef.trim(),
    fingerprint: prepared.fingerprint,
    purpose: prepared.purpose,
    publicRoute: prepared.publicRoute,
    network: prepared.network,
    contract: prepared.contract,
    algorithm: prepared.algorithm,
  };
}

export async function prepareOracleSeal({
  appId = ORACLE_SEAL_APP_ID,
  network,
  purpose,
  publicRoute,
  payload,
  seal,
  verifyKey,
  onPhase,
  onPrepared,
}: PrepareOracleSealInput): Promise<StoredOracleSealReceipt> {
  if (appId !== ORACLE_SEAL_APP_ID) {
    throw new OracleSealInputError("invalid", "Unexpected seal application identity");
  }
  const draft = parseDraft({ purpose, publicRoute, payload });

  onPhase?.("key");
  const key = validateOracleSealKey(
    await seal.publicKey({ forceRefresh: true }),
    network,
  );
  try {
    await verifyKey?.(key);
  } catch (error) {
    throw error instanceof FrameworkSealError
      ? error
      : new FrameworkSealError("key", error);
  }

  onPhase?.("encrypt");
  const encrypted = await seal.encrypt({
    kind: ORACLE_SEAL_PAYLOAD_KIND,
    app_id: ORACLE_SEAL_APP_ID,
    target_chain: "neo_n3",
    network,
    purpose: draft.purpose,
    public_route: draft.publicRoute || null,
    payload: draft.parsedPayload,
  });
  validateOracleSealKey(encrypted.key, network);
  if (
    encrypted.key.publicKey !== key.publicKey ||
    encrypted.key.contract.toLowerCase() !== key.contract.toLowerCase() ||
    encrypted.key.algorithm !== key.algorithm
  ) {
    throw new FrameworkSealError("key", "Morpheus encryption key changed while sealing");
  }
  if (!isMorpheusCiphertextEnvelope(encrypted.ciphertext)) {
    throw new FrameworkSealError("package", "Morpheus encryption returned an invalid ciphertext envelope");
  }

  const fingerprint = await ciphertextFingerprint(encrypted.ciphertext);
  const contract = key.contract.toLowerCase();
  const prepared: PreparedOracleSeal = {
    name: `oracle-seal:${fingerprint.slice(2, 26)}`,
    ciphertext: encrypted.ciphertext,
    publicEnvelope: {
      kind: ORACLE_SEAL_PACKET_KIND,
      app_id: ORACLE_SEAL_APP_ID,
      target_chain: "neo_n3",
      network,
      purpose: draft.purpose,
      public_route: draft.publicRoute || null,
      ciphertext_fingerprint: fingerprint,
      encryption_algorithm: MORPHEUS_ENCRYPTION_ALGORITHM,
      oracle_contract: contract,
    },
    fingerprint,
    purpose: draft.purpose,
    publicRoute: draft.publicRoute,
    network,
    contract,
    algorithm: MORPHEUS_ENCRYPTION_ALGORITHM,
    keyFetchedAt: key.fetchedAt,
  };
  await onPrepared?.(prepared);

  onPhase?.("store");
  return storePreparedOracleSeal({ appId, prepared, seal });
}

export function normalizeOracleSealError(error: unknown): OracleSealErrorKey {
  if (error instanceof OracleSealInputError) {
    return error.reason === "too_large" ? "sealErrorTooLarge" : "sealErrorInput";
  }
  // Only a FrameworkSealError carries a trustworthy phase. Defaulting unknown
  // errors to "package" used to mislabel runtime/availability failures as
  // "local encryption failed" even though no encryption was attempted.
  const phase = error instanceof FrameworkSealError ? error.phase : null;
  const raw = error instanceof Error ? error.message : String(error ?? "");
  if (
    (error instanceof Error && error.name === "OracleSealStorageError")
    || /device (?:recovery storage|receipt history)|save the recovery packet|clear the recovery packet/i.test(raw)
  ) {
    return "sealErrorStorage";
  }
  if (/timeout|timed out|abort/i.test(raw)) return "sealErrorTimeout";
  if (/algorithm|HKDF|AES|WebCrypto|SHA-256/i.test(raw)) return "sealErrorAlgorithm";
  if (/confidential store capability|store credentials|store route/i.test(raw)) return "sealErrorService";
  if (phase === "key" || /public key|contract|network|stale|X25519 key/i.test(raw)) {
    return "sealErrorKey";
  }
  if (phase === "store" || /secret reference|secret_ref|store|ciphertext packet/i.test(raw)) {
    return "sealErrorStore";
  }
  if (phase === "package" || /encrypt|ciphertext|envelope/i.test(raw)) {
    return "sealErrorEncrypt";
  }
  return "sealErrorGeneric";
}
