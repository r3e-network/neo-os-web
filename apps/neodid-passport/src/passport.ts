import { DEFAULT_SUBJECT_DID } from "./appConfig";

export type PassportProvider = "wallet" | "github" | "email";
export type PassportNetwork = "mainnet" | "testnet";

export interface PassportForm {
  subject: string;
  provider: PassportProvider;
  claim: string;
  audience: string;
}

export interface ResolvedDidSummary {
  id: string;
  controller: string[];
  versionId: string;
  anchorContract: string;
  serviceTypes: string[];
  contentType: string;
  raw: Record<string, unknown>;
}

export interface PassportProof {
  provider: PassportProvider;
  type: "NeoWalletSignature2026" | "ExternalAttestationPrepared";
  status: "prepared" | "signed";
  signature?: string;
  publicKey?: string;
  address?: string;
  signedAt?: string;
  messageDigest?: string;
}

export interface PassportPayload {
  kind: "neodid.passport.credential";
  schema: "https://schemas.r3e.network/neodid/passport/v1";
  network: PassportNetwork;
  subject: string;
  provider: PassportProvider;
  claim: string;
  audience: string;
  issuedAt: string;
  resolver: {
    endpoint: string;
    status: "resolved";
    contentType: string;
  };
  didDocument: {
    id: string;
    controller: string[];
    versionId: string;
    anchorContract: string;
    serviceTypes: string[];
    serviceCount: number;
  };
  proof: PassportProof;
  digest: string;
}

type SignedMessageLike =
  | string
  | null
  | {
      signature?: unknown;
      data?: unknown;
      publicKey?: unknown;
      address?: unknown;
    };

const DEFAULT_FORM: PassportForm = {
  subject: DEFAULT_SUBJECT_DID,
  provider: "wallet",
  claim: "wallet-ownership",
  audience: "miniapp-neodid-passport",
};

function clean(value: unknown, fallback = "") {
  const text = String(value ?? "").trim();
  return text.length > 0 ? text : fallback;
}

export function normalizeProvider(value: unknown): PassportProvider {
  const provider = clean(value, "wallet").toLowerCase();
  if (provider === "github" || provider === "email") return provider;
  return "wallet";
}

export function normalizeNetwork(value: unknown): PassportNetwork {
  const network = clean(value, "testnet").toLowerCase();
  if (network === "mainnet" || network === "neo-n3-mainnet") return "mainnet";
  return "testnet";
}

export function normalizePassportForm(
  value: unknown,
  launchParams: Record<string, string> = {},
): PassportForm {
  const source = value && typeof value === "object"
    ? value as Record<string, unknown>
    : {};
  return {
    subject: clean(source.subject, clean(launchParams.subject, DEFAULT_FORM.subject)),
    provider: normalizeProvider(source.provider ?? launchParams.provider ?? DEFAULT_FORM.provider),
    claim: clean(source.claim, clean(launchParams.claim, DEFAULT_FORM.claim)),
    audience: clean(source.audience, clean(launchParams.audience, DEFAULT_FORM.audience)),
  };
}

export function isMorpheusDid(value: string) {
  const parts = clean(value).split(":");
  if (parts.length < 5) return false;
  if (parts[0] !== "did" || parts[1] !== "morpheus" || parts[2] !== "neo_n3") return false;
  const kind = parts[3];
  const subject = parts.slice(4).join(":");
  if (kind === "service") return subject.toLowerCase() === "neodid";
  if (kind === "vault") return /^[0-9a-f]{40}$/i.test(subject.replace(/^0x/i, ""));
  if (kind === "aa") return subject.trim().length > 0 && new TextEncoder().encode(subject).length <= 160;
  return false;
}

export function validatePassportForm(form: PassportForm) {
  if (!isMorpheusDid(form.subject)) return "passportInvalidDid";
  if (!form.claim) return "passportMissingClaim";
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
  const encoded = new TextEncoder().encode(value);
  const subtle = globalThis.crypto?.subtle;
  if (subtle) {
    const digest = await subtle.digest("SHA-256", encoded);
    return Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  }

  let hash = 2166136261;
  for (const byte of encoded) {
    hash ^= byte;
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(64, "0");
}

function readStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => String(item)).filter(Boolean);
  if (typeof value === "string" && value) return [value];
  return [];
}

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
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
  const params = new URLSearchParams({
    did: subject,
    network,
  });
  return `/api/morpheus/neodid/resolve?${params.toString()}`;
}

export async function resolveDidDocument(
  form: PassportForm,
  network: PassportNetwork,
  fetcher: typeof fetch = fetch,
): Promise<ResolvedDidSummary> {
  const endpoint = didResolveEndpoint(form.subject, network);
  const response = await fetcher(endpoint, {
    method: "GET",
    headers: { accept: "application/json" },
    cache: "no-store",
  });
  const contentType = response.headers.get("content-type") || "application/json";
  const text = await response.text();
  let payload: Record<string, unknown> = {};

  if (text) {
    try {
      payload = JSON.parse(text) as Record<string, unknown>;
    } catch {
      throw new Error("resolverFailed");
    }
  }

  if (!response.ok) {
    throw new Error(errorFromResolutionPayload(payload, "resolverFailed"));
  }

  const didDocument = extractDidDocument(payload);
  const metadata = readRecord(payload.didDocumentMetadata);
  const services = Array.isArray(didDocument.service) ? didDocument.service : [];
  const serviceTypes = services
    .map((service) => clean(readRecord(service).type))
    .filter(Boolean);

  if (!didDocument.id) {
    throw new Error("resolverFailed");
  }

  return {
    id: clean(didDocument.id),
    controller: readStringArray(didDocument.controller),
    versionId: clean(metadata.versionId, "unversioned"),
    anchorContract: clean(metadata.anchorContract),
    serviceTypes,
    contentType,
    raw: payload,
  };
}

export async function buildPassportPayload(
  form: PassportForm,
  resolution: ResolvedDidSummary,
  network: PassportNetwork,
  issuedAt = new Date().toISOString(),
): Promise<PassportPayload> {
  const endpoint = didResolveEndpoint(form.subject, network);
  const base = {
    kind: "neodid.passport.credential" as const,
    schema: "https://schemas.r3e.network/neodid/passport/v1" as const,
    network,
    subject: form.subject,
    provider: form.provider,
    claim: form.claim,
    audience: form.audience,
    issuedAt,
    resolver: {
      endpoint,
      status: "resolved" as const,
      contentType: resolution.contentType,
    },
    didDocument: {
      id: resolution.id,
      controller: resolution.controller,
      versionId: resolution.versionId,
      anchorContract: resolution.anchorContract,
      serviceTypes: resolution.serviceTypes,
      serviceCount: resolution.serviceTypes.length,
    },
    proof: {
      provider: form.provider,
      type: form.provider === "wallet" ? "NeoWalletSignature2026" as const : "ExternalAttestationPrepared" as const,
      status: "prepared" as const,
    },
  };

  const digest = await sha256Hex(canonicalize(base));
  return { ...base, digest };
}

export async function attachWalletSignature(
  payload: PassportPayload,
  signed: SignedMessageLike,
  address = "",
  signedAt = new Date().toISOString(),
): Promise<PassportPayload> {
  const result = typeof signed === "object" && signed ? signed : {};
  const signature = typeof signed === "string"
    ? signed
    : clean(result.signature, clean(result.data));
  const publicKey = clean(result.publicKey);
  const walletAddress = clean(result.address, address);
  const messageDigest = await sha256Hex(canonicalize(payload));

  return {
    ...payload,
    proof: {
      ...payload.proof,
      status: "signed",
      signature,
      publicKey,
      address: walletAddress,
      signedAt,
      messageDigest,
    },
  };
}

export function shortHash(value: string) {
  if (!value) return "";
  if (value.length <= 18) return value;
  return `${value.slice(0, 10)}...${value.slice(-8)}`;
}
