import { getRpcUrl } from "@shared/constants/rpc";
import { MORPHEUS_PUBLIC_REGISTRY } from "@shared/constants/generated-morpheus-registry";
import { fetchWithTimeout } from "@shared/utils/fetch-timeout";
import { addressToScriptHash, ownerMatchesAddress } from "@shared/utils/neo";
import { DEFAULT_SUBJECT_DID } from "./appConfig";

export type PassportNetwork = "mainnet" | "testnet";
export type PassportProofStatus = "prepared" | "attached";
export type RegistryProbeStatus = "idle" | "checking" | "verified" | "unavailable" | "mismatch";

export interface PassportForm {
  subject: string;
  claim: string;
  audience: string;
}

export interface ResolvedDidSummary {
  id: string;
  controller: string[];
  versionId: string;
  anchorContract: string;
  serviceTypes: string[];
  serviceCount: number;
  verificationMethodCount: number;
  runtimeAttested: boolean;
  contentType: string;
  raw: Record<string, unknown>;
}

export interface PassportProof {
  provider: "wallet";
  type: "NeoWalletMessageSignature";
  status: PassportProofStatus;
  verification: "not-performed";
  verificationLimitation: "wallet-preimage-convention-not-disclosed";
  signature?: string;
  signatureEncoding?: "hex" | "base64";
  publicKey?: string;
  address?: string;
  network?: PassportNetwork;
  signedAt?: string;
  messageDigest?: string;
  signedMessage?: string;
  requestInterface?: "framework.chain.signMessage(text)";
  preimageConvention?: "wallet-adapter-specific-not-disclosed";
}

export interface PassportPayload {
  kind: "neodid.passport.review";
  formatVersion: 1;
  network: PassportNetwork;
  subject: string;
  claim: string;
  audience: string;
  issuer: "self-authored-local-review";
  issuedAt: string;
  expiresAt: string;
  nonce: string;
  resolver: {
    endpoint: string;
    status: "document-returned";
    contentType: string;
    snapshot: Record<string, unknown>;
  };
  registry: NeoDidRegistryProbe;
  didDocument: {
    id: string;
    controller: string[];
    versionId: string;
    anchorContract: string;
    serviceTypes: string[];
    serviceCount: number;
    verificationMethodCount: number;
  };
  assurance: {
    claimVerification: "not-performed";
    didWalletBinding: "not-checked";
    registryAnchor: "deployment-verified" | "declared-unchecked" | "unavailable" | "mismatch";
    runtimeAttestation: "metadata-available" | "unavailable";
    walletProof: "not-attached" | "attached-unverified";
  };
  proof: PassportProof;
  digest: string;
}

export interface PassportPendingOperation {
  version: 1;
  network: PassportNetwork;
  phase: "resolving" | "signing";
  form: PassportForm;
  payloadDigest: string;
  startedAt: string;
}

export interface NeoDidRegistryProbe {
  environment: PassportNetwork;
  status: RegistryProbeStatus;
  contract: string;
  contractName: string;
  networkMagic: number | null;
  checkedAt: string;
  reason:
    | "not-checked"
    | "verified-deployment"
    | "no-network-deployment"
    | "resolver-anchor-missing"
    | "resolver-anchor-mismatch"
    | "network-mismatch"
    | "contract-state-mismatch"
    | "rpc-unavailable";
}

export interface RpcRequest {
  (url: string, method: string, params?: unknown[]): Promise<unknown>;
}

type SignedMessageLike =
  | string
  | null
  | {
      signature?: unknown;
      data?: unknown;
      publicKey?: unknown;
      address?: unknown;
      account?: unknown;
    };

const DEFAULT_FORM: PassportForm = {
  subject: DEFAULT_SUBJECT_DID,
  claim: "wallet-signature-context",
  audience: "miniapp-neodid-passport",
};

const HASH160_PATTERN = /^0x[0-9a-f]{40}$/i;
const DIGEST_PATTERN = /^[0-9a-f]{64}$/;
const NONCE_PATTERN = /^[0-9a-f]{32}$/;
const CONTROL_PATTERN = /[\u0000-\u001f\u007f]/;
const MAX_DID_BYTES = 256;
const MAX_CLAIM_BYTES = 96;
const MAX_AUDIENCE_BYTES = 160;
const PASSPORT_TTL_MS = 10 * 60 * 1000;
const PENDING_TTL_MS = 5 * 60 * 1000;
const MAX_RESOLUTION_BYTES = 256 * 1024;
const MAX_CONTROLLER_ITEMS = 64;
const MAX_DOCUMENT_ITEMS = 256;
const MAX_METADATA_TEXT_BYTES = 256;
const RESOLVER_TIMEOUT_MS = 10_000;

export const PASSPORT_FIELD_LIMITS = {
  subject: MAX_DID_BYTES,
  claim: MAX_CLAIM_BYTES,
  audience: MAX_AUDIENCE_BYTES,
} as const;

function clean(value: unknown, fallback = "") {
  const text = String(value ?? "").trim();
  return text.length > 0 ? text : fallback;
}

function byteLength(value: string) {
  return new TextEncoder().encode(value).length;
}

export function passportUtf8Length(value: string) {
  return byteLength(value);
}

export function truncatePassportUtf8(value: string, maxBytes: number) {
  let result = "";
  let used = 0;
  for (const symbol of String(value ?? "")) {
    const symbolBytes = byteLength(symbol);
    if (used + symbolBytes > maxBytes) break;
    result += symbol;
    used += symbolBytes;
  }
  return result;
}

function readInput(
  source: Record<string, unknown>,
  key: keyof PassportForm,
  launchParams: Record<string, string>,
  fallback: string,
) {
  if (Object.prototype.hasOwnProperty.call(source, key)) {
    const value = source[key];
    return typeof value === "string" ? value.trim() : "";
  }
  return clean(launchParams[key], fallback);
}

export function explicitPassportNetwork(value: unknown): PassportNetwork | null {
  const raw = clean(value).toLowerCase();
  if (raw === "mainnet" || raw === "neo-n3-mainnet") return "mainnet";
  if (raw === "testnet" || raw === "neo-n3-testnet") return "testnet";
  return null;
}

export function normalizeNetwork(value: unknown): PassportNetwork {
  return explicitPassportNetwork(value) ?? "testnet";
}

function decodeDidSegment(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function canonicalMorpheusDid(value: unknown): string | null {
  const raw = clean(value);
  if (!raw || CONTROL_PATTERN.test(raw) || byteLength(raw) > MAX_DID_BYTES) return null;
  const parts = raw.split(":");
  if (parts.length < 5 || parts[0] !== "did" || parts[1] !== "morpheus" || parts[2] !== "neo_n3") {
    return null;
  }
  const kind = parts[3]?.toLowerCase();
  const subject = decodeDidSegment(parts.slice(4).join(":")).trim();
  if (kind === "service") {
    return subject.toLowerCase() === "neodid" ? DEFAULT_SUBJECT_DID : null;
  }
  if (kind === "vault") {
    const hash = subject.replace(/^0x/i, "").toLowerCase();
    return /^[0-9a-f]{40}$/.test(hash)
      ? `did:morpheus:neo_n3:vault:${hash}`
      : null;
  }
  if (kind === "aa" && subject && !CONTROL_PATTERN.test(subject) && byteLength(subject) <= 160) {
    return `did:morpheus:neo_n3:aa:${encodeURIComponent(subject)}`;
  }
  return null;
}

export function normalizePassportForm(
  value: unknown,
  launchParams: Record<string, string> = {},
): PassportForm {
  const source = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  return {
    subject: readInput(source, "subject", launchParams, DEFAULT_FORM.subject),
    claim: readInput(source, "claim", launchParams, DEFAULT_FORM.claim),
    audience: readInput(source, "audience", launchParams, DEFAULT_FORM.audience),
  };
}

export function validatePassportForm(form: PassportForm) {
  if (!canonicalMorpheusDid(form.subject)) return "passportInvalidDid";
  if (!form.claim || CONTROL_PATTERN.test(form.claim) || byteLength(form.claim) > MAX_CLAIM_BYTES) {
    return "passportClaimInvalid";
  }
  if (!form.audience || CONTROL_PATTERN.test(form.audience) || byteLength(form.audience) > MAX_AUDIENCE_BYTES) {
    return "passportAudienceInvalid";
  }
  return "";
}

function sortJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJsonValue);
  if (!value || typeof value !== "object") return value ?? null;
  return Object.keys(value as Record<string, unknown>)
    .sort()
    .reduce<Record<string, unknown>>((acc, key) => {
      const next = (value as Record<string, unknown>)[key];
      if (next !== undefined) acc[key] = sortJsonValue(next);
      return acc;
    }, {});
}

export function canonicalize(value: unknown) {
  return JSON.stringify(sortJsonValue(value));
}

export async function sha256Hex(value: string) {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error("shaUnavailable");
  const digest = await subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function createPassportNonce() {
  if (!globalThis.crypto?.getRandomValues) throw new Error("nonceUnavailable");
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function readBoundedStringArray(
  value: unknown,
  maxItems: number,
  maxItemBytes = MAX_METADATA_TEXT_BYTES,
): string[] | null {
  if (value === undefined || value === null) return [];
  const source = typeof value === "string" ? [value] : value;
  if (!Array.isArray(source) || source.length > maxItems) return null;
  const result: string[] = [];
  for (const item of source) {
    if (typeof item !== "string") return null;
    const text = item.trim();
    if (!text || CONTROL_PATTERN.test(text) || byteLength(text) > maxItemBytes) return null;
    result.push(text);
  }
  return result;
}

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isSafeCount(value: unknown) {
  return Number.isSafeInteger(value) && Number(value) >= 0 && Number(value) <= MAX_DOCUMENT_ITEMS;
}

function hasValidDocumentFields(value: PassportPayload["didDocument"]) {
  const controllers = readBoundedStringArray(value?.controller, MAX_CONTROLLER_ITEMS);
  const serviceTypes = readBoundedStringArray(value?.serviceTypes, MAX_DOCUMENT_ITEMS);
  const versionId = clean(value?.versionId);
  const anchor = clean(value?.anchorContract).toLowerCase();
  return Boolean(
    value &&
    canonicalMorpheusDid(value.id) &&
    controllers &&
    serviceTypes &&
    versionId &&
    !CONTROL_PATTERN.test(versionId) &&
    byteLength(versionId) <= 160 &&
    (!anchor || HASH160_PATTERN.test(anchor)) &&
    isSafeCount(value.serviceCount) &&
    isSafeCount(value.verificationMethodCount)
  );
}

function extractDidDocument(payload: Record<string, unknown>) {
  const nested = readRecord(payload.didDocument);
  if (nested.id) return nested;
  return payload.id ? payload : {};
}

function errorFromResolutionPayload(payload: Record<string, unknown>, fallback: string) {
  const metadata = readRecord(payload.didResolutionMetadata);
  return clean(metadata.message, clean(metadata.error, fallback));
}

export function didResolveEndpoint(subject: string, network: PassportNetwork) {
  const canonicalSubject = canonicalMorpheusDid(subject) ?? subject;
  const params = new URLSearchParams({ did: canonicalSubject, network });
  return `/api/morpheus/neodid/resolve?${params.toString()}`;
}

export async function resolveDidDocument(
  form: PassportForm,
  network: PassportNetwork,
  fetcher: typeof fetch = fetch,
  signal?: AbortSignal,
): Promise<ResolvedDidSummary> {
  const expectedId = canonicalMorpheusDid(form.subject);
  if (!expectedId) throw new Error("passportInvalidDid");
  const endpoint = didResolveEndpoint(expectedId, network);
  const requestInit: RequestInit = {
    method: "GET",
    headers: { accept: "application/json" },
    cache: "no-store",
    signal,
  };
  const response = fetcher === fetch
    ? await fetchWithTimeout(endpoint, { ...requestInit, timeoutMs: RESOLVER_TIMEOUT_MS })
    : await fetcher(endpoint, requestInit);
  const rawContentType = clean(response.headers.get("content-type"), "application/json");
  const contentType = CONTROL_PATTERN.test(rawContentType) || byteLength(rawContentType) > 200
    ? "application/octet-stream"
    : rawContentType;
  const text = await response.text();
  if (byteLength(text) > MAX_RESOLUTION_BYTES) throw new Error("resolverFailed");
  let payload: Record<string, unknown> = {};

  if (text) {
    try {
      payload = JSON.parse(text) as Record<string, unknown>;
    } catch {
      throw new Error("resolverFailed");
    }
  }
  if (!response.ok) throw new Error(errorFromResolutionPayload(payload, "resolverFailed"));

  if (
    Object.prototype.hasOwnProperty.call(payload, "didDocument") &&
    !isRecord(payload.didDocument)
  ) throw new Error("resolverFailed");
  if (
    Object.prototype.hasOwnProperty.call(payload, "didDocumentMetadata") &&
    !isRecord(payload.didDocumentMetadata)
  ) throw new Error("resolverFailed");
  const didDocument = extractDidDocument(payload);
  if (!isRecord(didDocument)) throw new Error("resolverFailed");
  const metadata = readRecord(payload.didDocumentMetadata);
  const resolvedId = clean(didDocument.id);
  if (!resolvedId || resolvedId !== expectedId) throw new Error("resolverSubjectMismatch");
  const controller = readBoundedStringArray(didDocument.controller, MAX_CONTROLLER_ITEMS);
  if (!controller) throw new Error("resolverFailed");
  const rawServices = didDocument.service;
  if (
    rawServices !== undefined &&
    (!Array.isArray(rawServices) || rawServices.length > MAX_DOCUMENT_ITEMS)
  ) throw new Error("resolverFailed");
  const services = (rawServices ?? []) as unknown[];
  const serviceTypes: string[] = [];
  for (const service of services) {
    if (!isRecord(service)) throw new Error("resolverFailed");
    const types = readBoundedStringArray(service.type, 16, 160);
    if (!types || types.length === 0) throw new Error("resolverFailed");
    serviceTypes.push(...types);
  }
  const rawVerificationMethods = didDocument.verificationMethod;
  if (
    rawVerificationMethods !== undefined &&
    (!Array.isArray(rawVerificationMethods) ||
      rawVerificationMethods.length > MAX_DOCUMENT_ITEMS ||
      rawVerificationMethods.some((method) =>
        !isRecord(method) ||
        typeof method.id !== "string" ||
        !clean(method.id) ||
        CONTROL_PATTERN.test(clean(method.id)) ||
        byteLength(clean(method.id)) > MAX_METADATA_TEXT_BYTES
      ))
  ) throw new Error("resolverFailed");
  const verificationMethodCount = Array.isArray(rawVerificationMethods)
    ? rawVerificationMethods.length
    : 0;
  const rawAnchor = clean(metadata.anchorContract).toLowerCase();
  const anchorContract = HASH160_PATTERN.test(rawAnchor) && !/^0x0{40}$/.test(rawAnchor)
    ? rawAnchor
    : "";
  const rawVersionId = clean(metadata.versionId, "unversioned");
  const versionId = CONTROL_PATTERN.test(rawVersionId)
    ? "unversioned"
    : truncatePassportUtf8(rawVersionId, 160);

  return {
    id: resolvedId,
    controller,
    versionId,
    anchorContract,
    serviceTypes: Array.from(new Set(serviceTypes)),
    serviceCount: services.length,
    verificationMethodCount,
    runtimeAttested: versionId !== "unversioned" && verificationMethodCount > 0,
    contentType,
    raw: payload,
  };
}

function passportReviewBase(
  form: PassportForm,
  resolution: ResolvedDidSummary,
  network: PassportNetwork,
  issuedAt: string,
  expiresAt: string,
  nonce: string,
  registry: NeoDidRegistryProbe,
) {
  return {
    kind: "neodid.passport.review" as const,
    formatVersion: 1 as const,
    network,
    subject: resolution.id,
    claim: form.claim,
    audience: form.audience,
    issuer: "self-authored-local-review" as const,
    issuedAt,
    expiresAt,
    nonce,
    resolver: {
      endpoint: didResolveEndpoint(resolution.id, network),
      status: "document-returned" as const,
      contentType: resolution.contentType,
      snapshot: resolution.raw,
    },
    registry,
    didDocument: {
      id: resolution.id,
      controller: resolution.controller,
      versionId: resolution.versionId,
      anchorContract: resolution.anchorContract,
      serviceTypes: resolution.serviceTypes,
      serviceCount: resolution.serviceCount,
      verificationMethodCount: resolution.verificationMethodCount,
    },
    assurance: {
      claimVerification: "not-performed" as const,
      didWalletBinding: "not-checked" as const,
      registryAnchor: registry.status === "verified"
        ? "deployment-verified" as const
        : registry.status === "mismatch"
          ? "mismatch" as const
          : resolution.anchorContract
            ? "declared-unchecked" as const
            : "unavailable" as const,
      runtimeAttestation: resolution.runtimeAttested ? "metadata-available" as const : "unavailable" as const,
      walletProof: "not-attached" as const,
    },
    proof: {
      provider: "wallet" as const,
      type: "NeoWalletMessageSignature" as const,
      status: "prepared" as const,
      verification: "not-performed" as const,
      verificationLimitation: "wallet-preimage-convention-not-disclosed" as const,
    },
  };
}

export async function buildPassportPayload(
  form: PassportForm,
  resolution: ResolvedDidSummary,
  network: PassportNetwork,
  issuedAt = new Date().toISOString(),
  nonce = createPassportNonce(),
  registry: NeoDidRegistryProbe = {
    environment: network,
    status: "idle",
    contract: resolution.anchorContract,
    contractName: "",
    networkMagic: null,
    checkedAt: "",
    reason: "not-checked",
  },
): Promise<PassportPayload> {
  const validationKey = validatePassportForm(form);
  if (validationKey) throw new Error(validationKey);
  if (canonicalMorpheusDid(resolution.id) !== canonicalMorpheusDid(form.subject)) {
    throw new Error("resolverSubjectMismatch");
  }
  if (!hasValidDocumentFields({
    id: resolution.id,
    controller: resolution.controller,
    versionId: resolution.versionId,
    anchorContract: resolution.anchorContract,
    serviceTypes: resolution.serviceTypes,
    serviceCount: resolution.serviceCount,
    verificationMethodCount: resolution.verificationMethodCount,
  })) throw new Error("resolverFailed");
  const snapshotDocument = extractDidDocument(resolution.raw);
  if (
    clean(snapshotDocument.id) !== resolution.id ||
    byteLength(canonicalize(resolution.raw)) > MAX_RESOLUTION_BYTES
  ) {
    throw new Error("resolverSubjectMismatch");
  }
  if (!isValidRegistryProbe(registry, network)) throw new Error("resolverFailed");
  const timestamp = Date.parse(issuedAt);
  if (!Number.isFinite(timestamp)) throw new Error("passportTimeInvalid");
  if (!NONCE_PATTERN.test(nonce)) throw new Error("nonceUnavailable");
  const normalizedIssuedAt = new Date(timestamp).toISOString();
  const expiresAt = new Date(timestamp + PASSPORT_TTL_MS).toISOString();
  const base = passportReviewBase(
    form,
    resolution,
    network,
    normalizedIssuedAt,
    expiresAt,
    nonce,
    registry,
  );
  const digest = await sha256Hex(canonicalize(base));
  return { ...base, digest };
}

function decodedBase64Length(value: string) {
  const noPadding = value.replace(/=+$/, "");
  return Math.floor((noPadding.length * 3) / 4);
}

function normalizePublicKey(value: unknown) {
  const raw = clean(value);
  if (!raw) return "";
  const hex = raw.replace(/^0x/i, "");
  if (!/^[0-9a-f]+$/i.test(hex) || (hex.length !== 66 && hex.length !== 130)) {
    throw new Error("walletSignFailed");
  }
  return `0x${hex.toLowerCase()}`;
}

export function normalizeWalletSignature(value: unknown): {
  signature: string;
  signatureEncoding: "hex" | "base64";
} {
  const raw = clean(value);
  if (!raw) throw new Error("walletSignFailed");
  const hex = raw.replace(/^0x/i, "");
  if (/^[0-9a-f]+$/i.test(hex) && hex.length % 2 === 0) {
    const bytes = hex.length / 2;
    if (bytes < 64 || bytes > 144) throw new Error("walletSignFailed");
    return { signature: `0x${hex.toLowerCase()}`, signatureEncoding: "hex" };
  }
  const base64 = raw.replace(/-/g, "+").replace(/_/g, "/").replace(/\s+/g, "");
  const base64Body = base64.replace(/=+$/, "");
  if (/^[A-Za-z0-9+/]+={0,2}$/.test(base64) && base64Body.length % 4 !== 1) {
    const padded = base64Body.padEnd(Math.ceil(base64Body.length / 4) * 4, "=");
    const bytes = decodedBase64Length(padded);
    if (bytes >= 64 && bytes <= 144) {
      return { signature: padded, signatureEncoding: "base64" };
    }
  }
  throw new Error("walletSignFailed");
}

function validNeoAddress(value: string) {
  return /^N[1-9A-HJ-NP-Za-km-z]{33}$/.test(value) && Boolean(addressToScriptHash(value));
}

export async function attachWalletSignature(
  payload: PassportPayload,
  signed: SignedMessageLike,
  address = "",
  network: PassportNetwork = payload.network,
  signedAt = new Date().toISOString(),
): Promise<PassportPayload> {
  if (payload.proof.status !== "prepared") throw new Error("passportAlreadySigned");
  if (Date.parse(payload.expiresAt) <= Date.now()) throw new Error("passportExpired");
  const result = typeof signed === "object" && signed ? signed : {};
  const signatureSource = typeof signed === "string"
    ? signed
    : result.signature ?? result.data;
  const normalized = normalizeWalletSignature(signatureSource);
  const publicKey = normalizePublicKey(result.publicKey);
  const connectedAddress = clean(address);
  const resultAddress = clean(result.address ?? result.account);
  if (resultAddress && connectedAddress && !ownerMatchesAddress(resultAddress, connectedAddress)) {
    throw new Error("walletAddressInvalid");
  }
  const walletAddress = connectedAddress || (validNeoAddress(resultAddress) ? resultAddress : "");
  if (!validNeoAddress(walletAddress)) throw new Error("walletAddressInvalid");
  const timestamp = Date.parse(signedAt);
  if (!Number.isFinite(timestamp)) throw new Error("passportTimeInvalid");
  const issuedAt = Date.parse(payload.issuedAt);
  const expiresAt = Date.parse(payload.expiresAt);
  if (
    !Number.isFinite(issuedAt) ||
    !Number.isFinite(expiresAt) ||
    timestamp < issuedAt ||
    timestamp > expiresAt
  ) throw new Error("passportTimeInvalid");
  if (network !== payload.network) throw new Error("walletNetworkMismatch");
  const signedMessage = canonicalize(payload);
  const messageDigest = await sha256Hex(signedMessage);

  return {
    ...payload,
    assurance: {
      ...payload.assurance,
      walletProof: "attached-unverified",
    },
    proof: {
      ...payload.proof,
      status: "attached",
      verification: "not-performed",
      verificationLimitation: "wallet-preimage-convention-not-disclosed",
      signature: normalized.signature,
      signatureEncoding: normalized.signatureEncoding,
      ...(publicKey ? { publicKey } : {}),
      address: walletAddress,
      network,
      signedAt: new Date(timestamp).toISOString(),
      messageDigest,
      signedMessage,
      requestInterface: "framework.chain.signMessage(text)",
      preimageConvention: "wallet-adapter-specific-not-disclosed",
    },
  };
}

function payloadReviewBase(payload: PassportPayload) {
  const resolution: ResolvedDidSummary = {
    id: payload.didDocument.id,
    controller: payload.didDocument.controller,
    versionId: payload.didDocument.versionId,
    anchorContract: payload.didDocument.anchorContract,
    serviceTypes: payload.didDocument.serviceTypes,
    serviceCount: payload.didDocument.serviceCount,
    verificationMethodCount: payload.didDocument.verificationMethodCount,
    runtimeAttested: payload.assurance.runtimeAttestation === "metadata-available",
    contentType: payload.resolver.contentType,
    raw: payload.resolver.snapshot,
  };
  return passportReviewBase(
    { subject: payload.subject, claim: payload.claim, audience: payload.audience },
    resolution,
    payload.network,
    payload.issuedAt,
    payload.expiresAt,
    payload.nonce,
    payload.registry,
  );
}

function isValidRegistryProbe(probe: NeoDidRegistryProbe, network: PassportNetwork) {
  if (!probe || probe.environment !== network) return false;
  if (!Number.isFinite(Date.parse(probe.checkedAt)) && probe.status !== "idle") return false;
  if (probe.status === "idle" && (probe.reason !== "not-checked" || probe.checkedAt !== "")) return false;
  if (CONTROL_PATTERN.test(probe.contractName) || byteLength(probe.contractName) > 100) return false;
  if (probe.contract && !HASH160_PATTERN.test(probe.contract)) return false;
  if (probe.networkMagic !== null && !Number.isSafeInteger(probe.networkMagic)) return false;

  const expectedContract = MORPHEUS_PUBLIC_REGISTRY[network].contracts.morpheusNeoDid.toLowerCase();
  const expectedMagic = MORPHEUS_PUBLIC_REGISTRY[network].networkMagic;
  if (probe.status === "idle") {
    return probe.reason === "not-checked" &&
      probe.checkedAt === "" &&
      probe.contractName === "" &&
      probe.networkMagic === null;
  }
  if (probe.status === "verified") {
    return probe.reason === "verified-deployment" &&
      probe.contract === expectedContract &&
      probe.contractName === "NeoDIDRegistry" &&
      probe.networkMagic === expectedMagic;
  }
  if (probe.status === "unavailable") {
    if (probe.reason === "no-network-deployment") {
      return !expectedContract && !probe.contract && probe.networkMagic === null;
    }
    if (probe.reason === "resolver-anchor-missing" || probe.reason === "rpc-unavailable") {
      return Boolean(expectedContract) && probe.contract === expectedContract && probe.networkMagic === null;
    }
    return false;
  }
  if (probe.status === "mismatch") {
    if (probe.reason === "resolver-anchor-mismatch") {
      return Boolean(expectedContract) && probe.contract !== expectedContract && probe.networkMagic === null;
    }
    if (probe.reason === "network-mismatch") {
      return probe.contract === expectedContract && probe.networkMagic !== expectedMagic;
    }
    if (probe.reason === "contract-state-mismatch") {
      return probe.contract === expectedContract && probe.networkMagic === expectedMagic;
    }
  }
  return false;
}

export async function restorePassportPayload(
  value: unknown,
  network: PassportNetwork,
  now = Date.now(),
): Promise<PassportPayload | null> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  try {
    const candidate = value as PassportPayload;
    if (
      candidate.kind !== "neodid.passport.review" ||
      candidate.formatVersion !== 1 ||
      candidate.network !== network ||
      candidate.issuer !== "self-authored-local-review" ||
      candidate.resolver?.status !== "document-returned" ||
      !candidate.resolver?.snapshot ||
      typeof candidate.resolver.snapshot !== "object" ||
      Array.isArray(candidate.resolver.snapshot) ||
      clean(extractDidDocument(candidate.resolver.snapshot).id) !== candidate.subject ||
      byteLength(canonicalize(candidate.resolver.snapshot)) > MAX_RESOLUTION_BYTES ||
      candidate.proof?.provider !== "wallet" ||
      candidate.proof?.type !== "NeoWalletMessageSignature" ||
      candidate.proof?.verification !== "not-performed" ||
      candidate.proof?.verificationLimitation !== "wallet-preimage-convention-not-disclosed" ||
      (candidate.proof.status !== "prepared" && candidate.proof.status !== "attached") ||
      candidate.assurance?.claimVerification !== "not-performed" ||
      candidate.assurance?.didWalletBinding !== "not-checked" ||
      !isValidRegistryProbe(candidate.registry, network) ||
      (candidate.registry.status !== "idle" && Date.parse(candidate.registry.checkedAt) > now + 60_000) ||
      !DIGEST_PATTERN.test(String(candidate.digest ?? "")) ||
      !NONCE_PATTERN.test(String(candidate.nonce ?? "")) ||
      !Number.isFinite(Date.parse(String(candidate.issuedAt ?? ""))) ||
      !Number.isFinite(Date.parse(String(candidate.expiresAt ?? ""))) ||
      Date.parse(candidate.expiresAt) - Date.parse(candidate.issuedAt) !== PASSPORT_TTL_MS ||
      Date.parse(candidate.issuedAt) > now + 60_000 ||
      Date.parse(candidate.expiresAt) <= now ||
      validatePassportForm({ subject: candidate.subject, claim: candidate.claim, audience: candidate.audience }) ||
      !hasValidDocumentFields(candidate.didDocument) ||
      canonicalMorpheusDid(candidate.didDocument?.id) !== canonicalMorpheusDid(candidate.subject) ||
      (candidate.registry.status === "verified" &&
        candidate.didDocument.anchorContract.toLowerCase() !== candidate.registry.contract) ||
      candidate.resolver.endpoint !== didResolveEndpoint(candidate.subject, network)
    ) {
      return null;
    }

    const base = payloadReviewBase(candidate);
    const digest = await sha256Hex(canonicalize(base));
    if (digest !== candidate.digest) return null;
    const unsigned: PassportPayload = { ...base, digest };
    if (candidate.proof.status === "prepared") return unsigned;

    const normalizedSignature = normalizeWalletSignature(candidate.proof.signature);
    const publicKey = normalizePublicKey(candidate.proof.publicKey);
    const address = clean(candidate.proof.address);
    if (!validNeoAddress(address) || candidate.proof.network !== network) return null;
    const signedAt = clean(candidate.proof.signedAt);
    const signedTimestamp = Date.parse(signedAt);
    if (
      !Number.isFinite(signedTimestamp) ||
      signedTimestamp < Date.parse(candidate.issuedAt) ||
      signedTimestamp > Date.parse(candidate.expiresAt)
    ) return null;
    const signedMessage = canonicalize(unsigned);
    const messageDigest = await sha256Hex(signedMessage);
    if (messageDigest !== candidate.proof.messageDigest) return null;
    if (
      candidate.proof.signedMessage !== signedMessage ||
      candidate.proof.requestInterface !== "framework.chain.signMessage(text)" ||
      candidate.proof.preimageConvention !== "wallet-adapter-specific-not-disclosed"
    ) return null;
    return {
      ...unsigned,
      assurance: { ...unsigned.assurance, walletProof: "attached-unverified" },
      proof: {
        ...unsigned.proof,
        status: "attached",
        verification: "not-performed",
        signature: normalizedSignature.signature,
        signatureEncoding: normalizedSignature.signatureEncoding,
        ...(publicKey ? { publicKey } : {}),
        address,
        network,
        signedAt: new Date(signedTimestamp).toISOString(),
        messageDigest,
        signedMessage,
        requestInterface: "framework.chain.signMessage(text)",
        preimageConvention: "wallet-adapter-specific-not-disclosed",
      },
    };
  } catch {
    return null;
  }
}

export function buildPassportPendingOperation(
  phase: PassportPendingOperation["phase"],
  network: PassportNetwork,
  form: PassportForm,
  payloadDigest = "",
  startedAt = new Date().toISOString(),
): PassportPendingOperation {
  const validationKey = validatePassportForm(form);
  if (validationKey) throw new Error(validationKey);
  if (phase === "signing" && !DIGEST_PATTERN.test(payloadDigest)) throw new Error("passportNoPayload");
  const timestamp = Date.parse(startedAt);
  if (!Number.isFinite(timestamp)) throw new Error("passportTimeInvalid");
  return {
    version: 1,
    network,
    phase,
    form: {
      subject: canonicalMorpheusDid(form.subject) ?? form.subject,
      claim: form.claim,
      audience: form.audience,
    },
    payloadDigest: phase === "signing" ? payloadDigest : "",
    startedAt: new Date(timestamp).toISOString(),
  };
}

export function restorePassportPendingOperation(
  value: unknown,
  network: PassportNetwork,
  now = Date.now(),
): PassportPendingOperation | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const pending = value as Partial<PassportPendingOperation>;
  if (
    pending.version !== 1 ||
    pending.network !== network ||
    (pending.phase !== "resolving" && pending.phase !== "signing") ||
    !pending.form ||
    typeof pending.startedAt !== "string" ||
    !Number.isFinite(Date.parse(pending.startedAt)) ||
    Date.parse(pending.startedAt) > now + 60_000 ||
    now - Date.parse(pending.startedAt) > PENDING_TTL_MS
  ) return null;
  try {
    return buildPassportPendingOperation(
      pending.phase,
      network,
      pending.form,
      String(pending.payloadDigest ?? ""),
      pending.startedAt,
    );
  } catch {
    return null;
  }
}

async function defaultRpcRequest(
  url: string,
  method: string,
  params: unknown[] = [],
): Promise<unknown> {
  const response = await fetchWithTimeout(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    timeoutMs: 8_000,
  });
  if (!response.ok) throw new Error(`Neo RPC returned HTTP ${response.status}`);
  const payload = await response.json() as { result?: unknown; error?: unknown };
  if (payload.error) throw new Error("Neo RPC request failed");
  return payload.result;
}

export async function probeNeoDidRegistry(
  environment: PassportNetwork,
  contract: string,
  rpc: RpcRequest = defaultRpcRequest,
  checkedAt = new Date().toISOString(),
): Promise<NeoDidRegistryProbe> {
  const expectedMagic = MORPHEUS_PUBLIC_REGISTRY[environment].networkMagic;
  const expectedContract = MORPHEUS_PUBLIC_REGISTRY[environment].contracts.morpheusNeoDid.toLowerCase();
  const normalizedContract = clean(contract).toLowerCase();
  if (!expectedContract) {
    return {
      environment,
      status: "unavailable",
      contract: "",
      contractName: "",
      networkMagic: null,
      checkedAt,
      reason: "no-network-deployment",
    };
  }
  if (!HASH160_PATTERN.test(normalizedContract) || /^0x0{40}$/.test(normalizedContract)) {
    return {
      environment,
      status: "unavailable",
      contract: expectedContract,
      contractName: "",
      networkMagic: null,
      checkedAt,
      reason: "resolver-anchor-missing",
    };
  }
  if (normalizedContract !== expectedContract) {
    return {
      environment,
      status: "mismatch",
      contract: normalizedContract,
      contractName: "",
      networkMagic: null,
      checkedAt,
      reason: "resolver-anchor-mismatch",
    };
  }
  try {
    const version = await rpc(getRpcUrl(environment), "getversion", []) as {
      protocol?: { network?: unknown };
    } | null;
    const magic = Number(version?.protocol?.network);
    if (magic !== expectedMagic) {
      return {
        environment,
        status: "mismatch",
        contract: normalizedContract,
        contractName: "",
        networkMagic: Number.isFinite(magic) ? magic : null,
        checkedAt,
        reason: "network-mismatch",
      };
    }
    const state = await rpc(getRpcUrl(environment), "getcontractstate", [normalizedContract]) as {
      manifest?: { name?: unknown };
    } | null;
    const contractName = clean(state?.manifest?.name);
    if (contractName !== "NeoDIDRegistry") {
      return {
        environment,
        status: "mismatch",
        contract: expectedContract,
        contractName,
        networkMagic: magic,
        checkedAt,
        reason: "contract-state-mismatch",
      };
    }
    return {
      environment,
      status: "verified",
      contract: normalizedContract,
      contractName,
      networkMagic: magic,
      checkedAt,
      reason: "verified-deployment",
    };
  } catch {
    return {
      environment,
      status: "unavailable",
      contract: normalizedContract,
      contractName: "",
      networkMagic: null,
      checkedAt,
      reason: "rpc-unavailable",
    };
  }
}

export function serializePassportPayload(payload: PassportPayload) {
  return JSON.stringify(payload, null, 2);
}

export function passportMatchesForm(payload: PassportPayload, form: PassportForm) {
  return payload.subject === canonicalMorpheusDid(form.subject) &&
    payload.claim === form.claim &&
    payload.audience === form.audience;
}

export function shortHash(value: string) {
  if (!value) return "";
  if (value.length <= 18) return value;
  return `${value.slice(0, 10)}...${value.slice(-8)}`;
}
