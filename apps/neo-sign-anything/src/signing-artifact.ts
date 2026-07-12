import { addressToScriptHash } from "@shared/utils/neo";

export const SIGNING_ENVELOPE_SCHEMA = "neo-sign-anything:v1";
export const SIGNATURE_PROOF_SCHEMA = "neo-sign-anything-proof:v1";
export const DEFAULT_SIGNING_DOMAIN = "neo-sign-anything";
export const MAX_SIGNING_BYTES = 16_384;
export const MAX_FILE_BYTES = 64 * 1024 * 1024;
export const MAX_HISTORY_ITEMS = 8;

export type SigningMode = "bound" | "exact";
export type PayloadKind = "text" | "file-digest";
export type SignatureEncoding = "hex" | "base64";

export interface FileDigestInfo {
  name: string;
  size: number;
  type: string;
  digest: string;
  payload: string;
}

export interface PreparedSigningPayload {
  mode: SigningMode;
  kind: PayloadKind;
  domain: string | null;
  network: string;
  account: string;
  content: string;
  contentBytes: number;
  contentSha256: string;
  signedText: string;
  signedBytes: number;
  signedSha256: string;
  file: FileDigestInfo | null;
}

export interface ExactPayloadPreview {
  exactText: string;
  bytes: number;
  sha256: string;
}

export interface SignatureProofArtifact {
  schema: typeof SIGNATURE_PROOF_SCHEMA;
  createdAt: string;
  signer: {
    address: string;
    network: string;
    binding: "signed-envelope" | "observed-request-context";
  };
  payload: {
    mode: SigningMode;
    kind: PayloadKind;
    domain: string | null;
    encoding: "utf-8";
    exactText: string;
    bytes: number;
    sha256: string;
    contentSha256: string;
    file: FileDigestInfo | null;
  };
  signature: {
    value: string;
    encoding: SignatureEncoding;
    publicKey: string | null;
  };
  assurance: {
    status: "wallet-returned";
    cryptographicallyVerifiedHere: false;
  };
}

export interface SignatureHistoryItem {
  id: string;
  createdAt: string;
  address: string;
  network: string;
  mode: SigningMode;
  kind: PayloadKind;
  domain: string | null;
  payloadSha256: string;
  payloadBytes: number;
  signatureEncoding: SignatureEncoding;
  hasPublicKey: boolean;
}

export interface NormalizedWalletSignature {
  value: string;
  encoding: SignatureEncoding;
  publicKey: string | null;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function utf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}

export async function sha256Utf8(value: string): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error("SHA-256 is unavailable in this browser context");
  const digest = await subtle.digest("SHA-256", new TextEncoder().encode(value));
  return bytesToHex(new Uint8Array(digest));
}

export async function prepareExactPayloadPreview(content: string): Promise<ExactPayloadPreview> {
  const exactText = String(content ?? "");
  if (!exactText.trim()) throw new Error("Enter a message or load a file digest first");
  const bytes = utf8ByteLength(exactText);
  if (bytes > MAX_SIGNING_BYTES) {
    throw new Error(`Signing payload exceeds ${MAX_SIGNING_BYTES} UTF-8 bytes`);
  }
  return {
    exactText,
    bytes,
    sha256: await sha256Utf8(exactText),
  };
}

export function normalizeNetworkId(value: unknown): string {
  const raw = String(value ?? "").trim().toLowerCase();
  if (raw === "mainnet" || raw === "neo-n3-mainnet") return "neo-n3-mainnet";
  if (raw === "testnet" || raw === "neo-n3-testnet") return "neo-n3-testnet";
  throw new Error("A confirmed Neo N3 mainnet or testnet network is required");
}

export function normalizeSigningDomain(value: string): string {
  const domain = value.trim().toLowerCase();
  if (!domain || domain.length > 64 || !/^[a-z0-9][a-z0-9._:/-]*$/.test(domain)) {
    throw new Error("Domain must be 1-64 URL-safe characters");
  }
  return domain;
}

export function normalizeSignerAddress(value: unknown): string {
  const address = String(value ?? "").trim();
  if (!address || !addressToScriptHash(address)) {
    throw new Error("Wallet returned an invalid Neo N3 address");
  }
  return address;
}

function safeHeaderValue(value: string): string {
  return encodeURIComponent(value.trim()).replace(/%20/g, "+");
}

export async function prepareSigningPayload(input: {
  account: string;
  content: string;
  domain: string;
  file?: FileDigestInfo | null;
  mode: SigningMode;
  network: string;
}): Promise<PreparedSigningPayload> {
  const content = String(input.content ?? "");
  if (!content.trim()) throw new Error("Enter a message or load a file digest first");

  const account = normalizeSignerAddress(input.account);
  const network = normalizeNetworkId(input.network);
  const kind: PayloadKind = input.file?.payload === content ? "file-digest" : "text";
  const file = kind === "file-digest" ? input.file ?? null : null;
  const contentBytes = utf8ByteLength(content);
  const contentSha256 = await sha256Utf8(content);

  let domain: string | null = null;
  let signedText = content;
  if (input.mode === "bound") {
    domain = normalizeSigningDomain(input.domain);
    const headers = [
      SIGNING_ENVELOPE_SCHEMA,
      `domain:${domain}`,
      `network:${network}`,
      `account:${account}`,
      `kind:${kind}`,
      "content-encoding:utf-8",
      `content-bytes:${contentBytes}`,
      `content-sha256:${contentSha256}`,
    ];
    if (file) {
      headers.push(
        `file-name-uri:${safeHeaderValue(file.name)}`,
        `file-bytes:${file.size}`,
        `file-type-uri:${safeHeaderValue(file.type || "application/octet-stream")}`,
        `file-sha256:${file.digest}`,
      );
    }
    signedText = `${headers.join("\n")}\n\n${content}`;
  }

  const signedBytes = utf8ByteLength(signedText);
  if (signedBytes > MAX_SIGNING_BYTES) {
    throw new Error(`Signing payload exceeds ${MAX_SIGNING_BYTES} UTF-8 bytes`);
  }

  return {
    mode: input.mode,
    kind,
    domain,
    network,
    account,
    content,
    contentBytes,
    contentSha256,
    signedText,
    signedBytes,
    signedSha256: signedText === content ? contentSha256 : await sha256Utf8(signedText),
    file,
  };
}

function decodedBase64Length(value: string): number {
  const noPadding = value.replace(/=+$/, "");
  return Math.floor((noPadding.length * 3) / 4);
}

function normalizePublicKey(value: unknown): string | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const hex = raw.replace(/^0x/i, "");
  if (!/^[0-9a-fA-F]+$/.test(hex) || (hex.length !== 66 && hex.length !== 130)) {
    throw new Error("Wallet returned an unsupported public key format");
  }
  return `0x${hex.toLowerCase()}`;
}

export function normalizeWalletSignature(input: {
  signature: unknown;
  publicKey?: unknown;
}): NormalizedWalletSignature {
  const raw = String(input.signature ?? "").trim();
  if (!raw) throw new Error("Wallet returned no signature");

  const hex = raw.replace(/^0x/i, "");
  if (/^[0-9a-fA-F]+$/.test(hex) && hex.length % 2 === 0) {
    const byteLength = hex.length / 2;
    if (byteLength < 64 || byteLength > 144) {
      throw new Error("Wallet returned an unsupported signature length");
    }
    return {
      value: `0x${hex.toLowerCase()}`,
      encoding: "hex",
      publicKey: normalizePublicKey(input.publicKey),
    };
  }

  const base64 = raw.replace(/-/g, "+").replace(/_/g, "/").replace(/\s+/g, "");
  const base64Body = base64.replace(/=+$/, "");
  if (
    /^[A-Za-z0-9+/]+={0,2}$/.test(base64) &&
    base64Body.length % 4 !== 1
  ) {
    const padded = base64Body.padEnd(Math.ceil(base64Body.length / 4) * 4, "=");
    const byteLength = decodedBase64Length(padded);
    if (byteLength >= 64 && byteLength <= 144) {
      return {
        value: padded,
        encoding: "base64",
        publicKey: normalizePublicKey(input.publicKey),
      };
    }
  }

  throw new Error("Wallet returned an unsupported signature format");
}

export function createSignatureProof(input: {
  createdAt?: string;
  payload: PreparedSigningPayload;
  signature: NormalizedWalletSignature;
}): SignatureProofArtifact {
  return {
    schema: SIGNATURE_PROOF_SCHEMA,
    createdAt: input.createdAt ?? new Date().toISOString(),
    signer: {
      address: input.payload.account,
      network: input.payload.network,
      binding: input.payload.mode === "bound" ? "signed-envelope" : "observed-request-context",
    },
    payload: {
      mode: input.payload.mode,
      kind: input.payload.kind,
      domain: input.payload.domain,
      encoding: "utf-8",
      exactText: input.payload.signedText,
      bytes: input.payload.signedBytes,
      sha256: input.payload.signedSha256,
      contentSha256: input.payload.contentSha256,
      file: input.payload.file,
    },
    signature: {
      value: input.signature.value,
      encoding: input.signature.encoding,
      publicKey: input.signature.publicKey,
    },
    assurance: {
      status: "wallet-returned",
      cryptographicallyVerifiedHere: false,
    },
  };
}

export function serializeSignatureProof(proof: SignatureProofArtifact): string {
  return JSON.stringify(proof, null, 2);
}

export function historyItemFromProof(proof: SignatureProofArtifact): SignatureHistoryItem {
  return {
    id: `${proof.payload.sha256.slice(0, 16)}:${proof.createdAt}`,
    createdAt: proof.createdAt,
    address: proof.signer.address,
    network: proof.signer.network,
    mode: proof.payload.mode,
    kind: proof.payload.kind,
    domain: proof.payload.domain,
    payloadSha256: proof.payload.sha256,
    payloadBytes: proof.payload.bytes,
    signatureEncoding: proof.signature.encoding,
    hasPublicKey: Boolean(proof.signature.publicKey),
  };
}

export function sanitizeSignatureHistory(value: unknown): SignatureHistoryItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is SignatureHistoryItem => {
      if (!item || typeof item !== "object") return false;
      const candidate = item as Partial<SignatureHistoryItem>;
      const createdAt = typeof candidate.createdAt === "string" ? candidate.createdAt : "";
      const address = typeof candidate.address === "string" ? candidate.address : "";
      const network = typeof candidate.network === "string" ? candidate.network : "";
      const domainIsValid = candidate.mode === "bound"
        ? typeof candidate.domain === "string" && (() => {
          try {
            return normalizeSigningDomain(candidate.domain) === candidate.domain;
          } catch {
            return false;
          }
        })()
        : candidate.mode === "exact" && candidate.domain === null;
      let networkIsValid = false;
      let addressIsValid = false;
      try {
        networkIsValid = normalizeNetworkId(network) === network;
        addressIsValid = Boolean(addressToScriptHash(address));
      } catch {
        networkIsValid = false;
        addressIsValid = false;
      }
      return Boolean(
        typeof candidate.id === "string" &&
        candidate.id.length > 0 &&
        candidate.id.length <= 160 &&
        createdAt.length <= 40 &&
        Number.isFinite(Date.parse(createdAt)) &&
        addressIsValid &&
        networkIsValid &&
        (candidate.mode === "bound" || candidate.mode === "exact") &&
        domainIsValid &&
        (candidate.kind === "text" || candidate.kind === "file-digest") &&
        typeof candidate.payloadSha256 === "string" &&
        /^[0-9a-f]{64}$/.test(candidate.payloadSha256) &&
        typeof candidate.payloadBytes === "number" &&
        Number.isInteger(candidate.payloadBytes) &&
        candidate.payloadBytes > 0 &&
        candidate.payloadBytes <= MAX_SIGNING_BYTES &&
        (candidate.signatureEncoding === "hex" || candidate.signatureEncoding === "base64") &&
        typeof candidate.hasPublicKey === "boolean"
      );
    })
    .slice(0, MAX_HISTORY_ITEMS);
}
