import { getRpcUrl } from "@shared/constants/rpc";
import { MORPHEUS_PUBLIC_REGISTRY } from "@shared/constants/generated-morpheus-registry";
import { fetchWithTimeout } from "@shared/utils/fetch-timeout";
import { DEFAULT_SUBJECT_DID } from "./appConfig";

export type NeoDidConsoleNetwork = "mainnet" | "testnet";
export type RegistryProbeStatus = "idle" | "verified" | "unavailable" | "mismatch";
export type CatalogStatus = "providers-returned" | "empty-fallback" | "unavailable";
export type ContextStatus =
  | "claim-listed"
  | "claim-unlisted"
  | "provider-unlisted"
  | "catalog-unavailable";

export interface NeoDidConsoleForm {
  did: string;
  provider: string;
  claim: string;
}

export interface NeoDidProvider {
  id: string;
  category: string;
  aliases: string[];
  authModes: string[];
  claimTypes: string[];
  derivesProviderUidInTee: boolean;
}

export interface ProviderCatalogSnapshot {
  endpoint: string;
  network: NeoDidConsoleNetwork;
  status: CatalogStatus;
  source: string;
  warning: string;
  providers: NeoDidProvider[];
  loadedAt: string;
  raw: Record<string, unknown> | null;
}

export interface ResolvedDidSummary {
  id: string;
  controller: string[];
  versionId: string;
  anchorContract: string;
  serviceTypes: string[];
  serviceCount: number;
  verificationMethodCount: number;
  runtimeVerifierMetadata: boolean;
  oracleGatewayDeclared: boolean;
  contentType: string;
  raw: Record<string, unknown>;
}

export interface NeoDidRegistryProbe {
  network: NeoDidConsoleNetwork;
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

export interface ProviderContextObservation {
  requestedProvider: string;
  requestedClaim: string;
  matchedProviderId: string;
  providerCategory: string;
  matchedBy: "id" | "alias" | "none";
  status: ContextStatus;
}

export interface NeoDidEvidenceSnapshot {
  kind: "oracle.neodid.evidence";
  formatVersion: 1;
  network: NeoDidConsoleNetwork;
  subject: string;
  createdAt: string;
  expiresAt: string;
  resolver: {
    endpoint: string;
    status: "document-returned";
    contentType: string;
    snapshot: Record<string, unknown>;
  };
  catalog: ProviderCatalogSnapshot;
  registry: NeoDidRegistryProbe;
  didDocument: {
    id: string;
    controller: string[];
    versionId: string;
    anchorContract: string;
    serviceTypes: string[];
    serviceCount: number;
    verificationMethodCount: number;
    runtimeVerifierMetadata: "available" | "unavailable";
    oracleGateway: "declared" | "not-declared";
  };
  context: ProviderContextObservation;
  boundaries: {
    identityVerification: "not-performed";
    claimAttestation: "not-performed";
    signatureVerification: "not-performed";
    oracleDispatch: "not-performed";
    providerCatalog: "metadata-only";
  };
  digest: string;
}

export interface NeoDidPendingOperation {
  version: 1;
  network: NeoDidConsoleNetwork;
  phase: "resolving";
  form: NeoDidConsoleForm;
  startedAt: string;
}

export interface RpcRequest {
  (url: string, method: string, params?: unknown[], signal?: AbortSignal): Promise<unknown>;
}

const DEFAULT_FORM: NeoDidConsoleForm = {
  did: DEFAULT_SUBJECT_DID,
  provider: "web3auth",
  claim: "Web3Auth_PrimaryIdentity",
};

const HASH160_PATTERN = /^0x[0-9a-f]{40}$/i;
const DIGEST_PATTERN = /^[0-9a-f]{64}$/;
const CONTROL_PATTERN = /[\u0000-\u001f\u007f]/;
const MAX_DID_BYTES = 256;
const MAX_PROVIDER_BYTES = 80;
const MAX_CLAIM_BYTES = 160;
const MAX_METADATA_TEXT_BYTES = 200;
const MAX_CONTROLLER_ITEMS = 16;
const MAX_DOCUMENT_ITEMS = 64;
const MAX_SERVICE_TYPES = 16;
const MAX_PROVIDER_ITEMS = 128;
const MAX_PROVIDER_ALIASES = 32;
const MAX_PROVIDER_AUTH_MODES = 32;
const MAX_PROVIDER_CLAIMS = 128;
const MAX_SERVICE_ENDPOINT_BYTES = 16 * 1024;
const MAX_RESPONSE_BYTES = 256 * 1024;
const EVIDENCE_TTL_MS = 15 * 60 * 1000;
const PENDING_TTL_MS = 5 * 60 * 1000;

export const CONSOLE_FIELD_LIMITS = {
  did: MAX_DID_BYTES,
  provider: MAX_PROVIDER_BYTES,
  claim: MAX_CLAIM_BYTES,
} as const;

function clean(value: unknown, fallback = "") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function byteLength(value: string) {
  return new TextEncoder().encode(value).length;
}

export function consoleUtf8Length(value: string) {
  return byteLength(value);
}

export function truncateConsoleUtf8(value: string, maxBytes: number) {
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

export function explicitConsoleNetwork(value: unknown): NeoDidConsoleNetwork | null {
  const raw = clean(value).toLowerCase();
  if (raw === "mainnet" || raw === "neo-n3-mainnet") return "mainnet";
  if (raw === "testnet" || raw === "neo-n3-testnet") return "testnet";
  return null;
}

export function normalizeConsoleNetwork(value: unknown): NeoDidConsoleNetwork {
  return explicitConsoleNetwork(value) ?? "mainnet";
}

function decodeDidSegment(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
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
  const decodedSubject = decodeDidSegment(parts.slice(4).join(":"));
  if (decodedSubject === null) return null;
  const subject = decodedSubject.trim();
  if (kind === "service") {
    return subject.toLowerCase() === "neodid" ? DEFAULT_SUBJECT_DID : null;
  }
  if (kind === "vault") {
    const hash = subject.replace(/^0x/i, "").toLowerCase();
    return /^[0-9a-f]{40}$/.test(hash) ? `did:morpheus:neo_n3:vault:${hash}` : null;
  }
  if (kind === "aa" && subject && byteLength(subject) <= 160 && !CONTROL_PATTERN.test(subject)) {
    return `did:morpheus:neo_n3:aa:${encodeURIComponent(subject)}`;
  }
  return null;
}

function readInput(
  source: Record<string, unknown>,
  key: keyof NeoDidConsoleForm,
  launchParams: Record<string, string>,
  fallback: string,
) {
  if (Object.prototype.hasOwnProperty.call(source, key)) return String(source[key] ?? "").trim();
  return clean(launchParams[key], fallback);
}

export function normalizeConsoleForm(
  value: unknown,
  launchParams: Record<string, string> = {},
): NeoDidConsoleForm {
  const source = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  return {
    did: readInput(source, "did", launchParams, DEFAULT_FORM.did),
    provider: readInput(source, "provider", launchParams, DEFAULT_FORM.provider),
    claim: readInput(source, "claim", launchParams, DEFAULT_FORM.claim),
  };
}

export function validateConsoleForm(form: NeoDidConsoleForm) {
  if (!canonicalMorpheusDid(form.did)) return "consoleInvalidDid";
  if (
    !form.provider || CONTROL_PATTERN.test(form.provider) ||
    byteLength(form.provider) > MAX_PROVIDER_BYTES
  ) return "consoleProviderInvalid";
  if (!form.claim || CONTROL_PATTERN.test(form.claim) || byteLength(form.claim) > MAX_CLAIM_BYTES) {
    return "consoleClaimInvalid";
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
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function readBoundedString(
  value: unknown,
  maxBytes: number,
  options: { optional?: boolean; fallback?: string } = {},
): string | null {
  const { optional = false, fallback = "" } = options;
  if (value === undefined || value === null || value === "") {
    return optional ? fallback : null;
  }
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (!text) return optional ? fallback : null;
  if (CONTROL_PATTERN.test(text) || byteLength(text) > maxBytes) return null;
  return text;
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
    const text = readBoundedString(item, maxItemBytes);
    if (!text) return null;
    result.push(text);
  }
  return result;
}

function extractDidDocument(payload: Record<string, unknown>) {
  const nested = readRecord(payload.didDocument);
  if (nested.id) return nested;
  return payload.id ? payload : {};
}

function responseError(payload: Record<string, unknown>, fallback: string) {
  const metadata = readRecord(payload.didResolutionMetadata);
  return readBoundedString(metadata.message, MAX_METADATA_TEXT_BYTES, { optional: true }) ||
    readBoundedString(metadata.error, MAX_METADATA_TEXT_BYTES, { optional: true }) ||
    readBoundedString(payload.error, MAX_METADATA_TEXT_BYTES, { optional: true }) ||
    fallback;
}

async function readJsonResponse(
  response: Response,
  fallbackError: string,
): Promise<Record<string, unknown>> {
  const text = await response.text();
  if (byteLength(text) > MAX_RESPONSE_BYTES) throw new Error(fallbackError);
  if (!text) return {};
  try {
    const payload: unknown = JSON.parse(text);
    if (!isRecord(payload) || !isBoundedJsonValue(payload)) throw new Error(fallbackError);
    return payload;
  } catch {
    throw new Error(fallbackError);
  }
}

/**
 * Bound response structure before recursive canonicalization. JSON.parse can
 * produce extremely deep objects or already-rounded unsafe integers even when
 * the byte size is modest; neither should enter an evidence snapshot.
 */
function isBoundedJsonValue(root: unknown, maxDepth = 64, maxNodes = 32_768) {
  const stack: Array<{ depth: number; value: unknown }> = [{ depth: 0, value: root }];
  let nodes = 0;
  while (stack.length > 0) {
    const entry = stack.pop();
    if (!entry || entry.depth > maxDepth || ++nodes > maxNodes) return false;
    const { value } = entry;
    if (value === null || typeof value === "boolean") continue;
    if (typeof value === "number") {
      if (!Number.isFinite(value) || (Number.isInteger(value) && !Number.isSafeInteger(value))) {
        return false;
      }
      continue;
    }
    if (typeof value === "string") {
      if (byteLength(value) > MAX_RESPONSE_BYTES) return false;
      continue;
    }
    if (Array.isArray(value)) {
      for (const item of value) stack.push({ depth: entry.depth + 1, value: item });
      continue;
    }
    if (!isRecord(value)) return false;
    for (const [key, item] of Object.entries(value)) {
      if (CONTROL_PATTERN.test(key) || byteLength(key) > MAX_METADATA_TEXT_BYTES) return false;
      stack.push({ depth: entry.depth + 1, value: item });
    }
  }
  return true;
}

function boundedContentType(value: string | null) {
  return readBoundedString(value, MAX_METADATA_TEXT_BYTES, { optional: true, fallback: "application/json" }) ??
    "application/json";
}

function validServiceEndpoint(value: unknown) {
  const uri = readBoundedString(value, 2_048);
  if (uri) return true;
  return isRecord(value) &&
    isBoundedJsonValue(value, 24, 2_048) &&
    byteLength(canonicalize(value)) <= MAX_SERVICE_ENDPOINT_BYTES;
}

export function didResolveEndpoint(subject: string, network: NeoDidConsoleNetwork) {
  const params = new URLSearchParams({
    did: canonicalMorpheusDid(subject) ?? subject,
    network,
  });
  return `/api/morpheus/neodid/resolve?${params.toString()}`;
}

export function providerCatalogEndpoint(network: NeoDidConsoleNetwork) {
  return `/api/morpheus/neodid/providers?${new URLSearchParams({ network }).toString()}`;
}

function summarizeResolutionPayload(
  payload: Record<string, unknown>,
  expectedId: string,
  contentType: string,
): ResolvedDidSummary {
  if (
    Object.prototype.hasOwnProperty.call(payload, "didDocument") &&
    !isRecord(payload.didDocument)
  ) throw new Error("resolverFailed");
  if (
    Object.prototype.hasOwnProperty.call(payload, "didDocumentMetadata") &&
    !isRecord(payload.didDocumentMetadata)
  ) throw new Error("resolverFailed");
  const document = extractDidDocument(payload);
  const metadata = readRecord(payload.didDocumentMetadata);
  const resolvedId = readBoundedString(document.id, MAX_DID_BYTES);
  if (!resolvedId || resolvedId !== expectedId) throw new Error("resolverSubjectMismatch");
  const controller = readBoundedStringArray(document.controller, MAX_CONTROLLER_ITEMS);
  if (!controller) throw new Error("resolverFailed");

  const rawServices = document.service;
  if (
    rawServices !== undefined &&
    (!Array.isArray(rawServices) || rawServices.length > MAX_DOCUMENT_ITEMS)
  ) throw new Error("resolverFailed");
  const services = (rawServices ?? []) as unknown[];
  const serviceTypes: string[] = [];
  for (const service of services) {
    if (!isRecord(service)) throw new Error("resolverFailed");
    if (!readBoundedString(service.id, MAX_DID_BYTES)) throw new Error("resolverFailed");
    if (!Object.prototype.hasOwnProperty.call(service, "serviceEndpoint") ||
      !validServiceEndpoint(service.serviceEndpoint)) {
      throw new Error("resolverFailed");
    }
    const types = readBoundedStringArray(service.type, MAX_SERVICE_TYPES);
    if (!types || types.length === 0) throw new Error("resolverFailed");
    serviceTypes.push(...types);
  }

  const rawVerificationMethods = document.verificationMethod;
  if (
    rawVerificationMethods !== undefined &&
    (!Array.isArray(rawVerificationMethods) ||
      rawVerificationMethods.length > MAX_DOCUMENT_ITEMS ||
      rawVerificationMethods.some((method) =>
        !isRecord(method) ||
        !readBoundedString(method.id, MAX_DID_BYTES) ||
        !readBoundedString(method.type, MAX_METADATA_TEXT_BYTES) ||
        !readBoundedString(method.controller, MAX_DID_BYTES)
      ))
  ) throw new Error("resolverFailed");
  const verificationMethodCount = Array.isArray(rawVerificationMethods)
    ? rawVerificationMethods.length
    : 0;

  const versionId = readBoundedString(metadata.versionId, 160, {
    optional: true,
    fallback: "unversioned",
  });
  if (!versionId) throw new Error("resolverFailed");
  const rawAnchor = readBoundedString(metadata.anchorContract, 42, { optional: true });
  if (rawAnchor === null) throw new Error("resolverFailed");
  const normalizedAnchor = rawAnchor.toLowerCase();
  if (normalizedAnchor && (!HASH160_PATTERN.test(normalizedAnchor) || /^0x0{40}$/.test(normalizedAnchor))) {
    throw new Error("resolverFailed");
  }

  return {
    id: resolvedId,
    controller,
    versionId,
    anchorContract: normalizedAnchor,
    serviceTypes: Array.from(new Set(serviceTypes)),
    serviceCount: services.length,
    verificationMethodCount,
    runtimeVerifierMetadata: versionId !== "unversioned" &&
      verificationMethodCount > 0 &&
      serviceTypes.includes("MorpheusNeoDIDRuntime"),
    oracleGatewayDeclared: serviceTypes.includes("MorpheusOracleGateway"),
    contentType: boundedContentType(contentType),
    raw: payload,
  };
}

export async function resolveDidDocument(
  form: NeoDidConsoleForm,
  network: NeoDidConsoleNetwork,
  fetcher: typeof fetch = fetch,
  signal?: AbortSignal,
): Promise<ResolvedDidSummary> {
  const expectedId = canonicalMorpheusDid(form.did);
  if (!expectedId) throw new Error("consoleInvalidDid");
  const response = await fetcher(didResolveEndpoint(expectedId, network), {
    method: "GET",
    headers: { accept: "application/json" },
    cache: "no-store",
    signal,
  });
  const payload = await readJsonResponse(response, "resolverFailed");
  if (!response.ok) throw new Error(responseError(payload, "resolverFailed"));
  return summarizeResolutionPayload(
    payload,
    expectedId,
    boundedContentType(response.headers.get("content-type")),
  );
}

function normalizeProvider(value: unknown): NeoDidProvider | null {
  if (!isRecord(value)) return null;
  const record = value;
  const id = readBoundedString(record.id, MAX_PROVIDER_BYTES);
  const category = readBoundedString(record.category, MAX_PROVIDER_BYTES, {
    optional: true,
    fallback: "uncategorized",
  });
  const aliases = readBoundedStringArray(record.aliases, MAX_PROVIDER_ALIASES, MAX_PROVIDER_BYTES);
  const authModes = readBoundedStringArray(
    record.auth_modes ?? record.authModes,
    MAX_PROVIDER_AUTH_MODES,
  );
  const claimTypes = readBoundedStringArray(
    record.claim_types ?? record.claimTypes,
    MAX_PROVIDER_CLAIMS,
    MAX_CLAIM_BYTES,
  );
  const derivesValue = record.derives_provider_uid_in_tee ?? record.derivesProviderUidInTee;
  if (
    !id || !category || !aliases || !authModes || !claimTypes ||
    (derivesValue !== undefined && derivesValue !== null && typeof derivesValue !== "boolean")
  ) return null;
  return {
    id,
    category,
    aliases,
    authModes,
    claimTypes,
    derivesProviderUidInTee: derivesValue === true,
  };
}

export function unavailableProviderCatalog(
  network: NeoDidConsoleNetwork,
  loadedAt = new Date().toISOString(),
): ProviderCatalogSnapshot {
  return {
    endpoint: providerCatalogEndpoint(network),
    network,
    status: "unavailable",
    source: "unavailable",
    warning: "provider-catalog-unavailable",
    providers: [],
    loadedAt,
    raw: null,
  };
}

export async function loadProviderCatalog(
  network: NeoDidConsoleNetwork,
  fetcher: typeof fetch = fetch,
  signal?: AbortSignal,
  loadedAt = new Date().toISOString(),
): Promise<ProviderCatalogSnapshot> {
  const endpoint = providerCatalogEndpoint(network);
  const response = await fetcher(endpoint, {
    method: "GET",
    headers: { accept: "application/json" },
    cache: "no-store",
    signal,
  });
  const payload = await readJsonResponse(response, "catalogFailed");
  if (!response.ok) throw new Error("catalogFailed");
  return catalogFromPayload(payload, network, endpoint, loadedAt);
}

function catalogFromPayload(
  payload: Record<string, unknown>,
  network: NeoDidConsoleNetwork,
  endpoint: string,
  loadedAt: string,
): ProviderCatalogSnapshot {
  if (Object.prototype.hasOwnProperty.call(payload, "network")) {
    const returnedNetwork = explicitConsoleNetwork(payload.network);
    if (returnedNetwork !== network) throw new Error("catalogNetworkMismatch");
  }
  if (!Array.isArray(payload.providers) || payload.providers.length > MAX_PROVIDER_ITEMS) {
    throw new Error("catalogFailed");
  }
  const providers = payload.providers.map(normalizeProvider);
  if (providers.some((item) => !item)) throw new Error("catalogFailed");
  const decodedProviders = providers as NeoDidProvider[];
  const identifiers = new Map<string, string>();
  for (const provider of decodedProviders) {
    for (const identifier of [provider.id, ...provider.aliases]) {
      const normalized = identifier.toLowerCase();
      const owner = identifiers.get(normalized);
      if (owner && owner !== provider.id) throw new Error("catalogFailed");
      if (owner === provider.id && normalized === provider.id.toLowerCase()) {
        throw new Error("catalogFailed");
      }
      identifiers.set(normalized, provider.id);
    }
  }
  const source = readBoundedString(payload.source, 100, {
    optional: true,
    fallback: decodedProviders.length ? "host-runtime" : "host-fallback",
  });
  const warning = readBoundedString(payload.warning, 240, { optional: true });
  if (source === null || warning === null) throw new Error("catalogFailed");
  return {
    endpoint,
    network,
    status: decodedProviders.length ? "providers-returned" : "empty-fallback",
    source,
    warning,
    providers: decodedProviders,
    loadedAt,
    raw: payload,
  };
}

export function observeProviderContext(
  catalog: ProviderCatalogSnapshot,
  form: NeoDidConsoleForm,
): ProviderContextObservation {
  if (catalog.status === "unavailable") {
    return {
      requestedProvider: form.provider,
      requestedClaim: form.claim,
      matchedProviderId: "",
      providerCategory: "",
      matchedBy: "none",
      status: "catalog-unavailable",
    };
  }
  const requested = form.provider.toLowerCase();
  const provider = catalog.providers.find((item) => item.id.toLowerCase() === requested) ??
    catalog.providers.find((item) => item.aliases.some((alias) => alias.toLowerCase() === requested));
  if (!provider) {
    return {
      requestedProvider: form.provider,
      requestedClaim: form.claim,
      matchedProviderId: "",
      providerCategory: "",
      matchedBy: "none",
      status: "provider-unlisted",
    };
  }
  return {
    requestedProvider: form.provider,
    requestedClaim: form.claim,
    matchedProviderId: provider.id,
    providerCategory: provider.category,
    matchedBy: provider.id.toLowerCase() === requested ? "id" : "alias",
    status: provider.claimTypes.includes(form.claim) ? "claim-listed" : "claim-unlisted",
  };
}

async function defaultRpcRequest(
  url: string,
  method: string,
  params: unknown[] = [],
  signal?: AbortSignal,
) {
  const response = await fetchWithTimeout(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    timeoutMs: 8_000,
    signal,
  });
  if (!response.ok) throw new Error("rpcUnavailable");
  const payload = await response.json() as { result?: unknown; error?: unknown };
  if (payload.error || payload.result === undefined || payload.result === null) {
    throw new Error("rpcUnavailable");
  }
  return payload.result;
}

export function idleRegistryProbe(network: NeoDidConsoleNetwork): NeoDidRegistryProbe {
  return {
    network,
    status: "idle",
    contract: "",
    contractName: "",
    networkMagic: null,
    checkedAt: "",
    reason: "not-checked",
  };
}

function readRpcNetworkMagic(value: unknown) {
  if (!isRecord(value) || !isRecord(value.protocol)) return null;
  const magic = value.protocol.network;
  return Number.isSafeInteger(magic) && Number(magic) >= 0 ? Number(magic) : null;
}

export async function probeNeoDidRegistry(
  network: NeoDidConsoleNetwork,
  resolverAnchor: string,
  rpc: RpcRequest = defaultRpcRequest,
  checkedAt = new Date().toISOString(),
  signal?: AbortSignal,
): Promise<NeoDidRegistryProbe> {
  const expected = MORPHEUS_PUBLIC_REGISTRY[network];
  const expectedContract = expected.contracts.morpheusNeoDid.toLowerCase();
  const anchor = clean(resolverAnchor).toLowerCase();
  if (!expectedContract) {
    if (HASH160_PATTERN.test(anchor) && !/^0x0{40}$/.test(anchor)) {
      return {
        network,
        status: "mismatch",
        contract: anchor,
        contractName: "",
        networkMagic: null,
        checkedAt,
        reason: "resolver-anchor-mismatch",
      };
    }
    try {
      const magic = readRpcNetworkMagic(await rpc(getRpcUrl(network), "getversion", [], signal));
      if (magic === null) throw new Error("rpcUnavailable");
      if (magic !== expected.networkMagic) {
        return {
          network,
          status: "mismatch",
          contract: "",
          contractName: "",
          networkMagic: magic,
          checkedAt,
          reason: "network-mismatch",
        };
      }
      return {
        network,
        status: "unavailable",
        contract: "",
        contractName: "",
        networkMagic: magic,
        checkedAt,
        reason: "no-network-deployment",
      };
    } catch (error) {
      if (signal?.aborted) throw error;
      return {
        network,
        status: "unavailable",
        contract: "",
        contractName: "",
        networkMagic: null,
        checkedAt,
        reason: "rpc-unavailable",
      };
    }
  }
  if (!HASH160_PATTERN.test(anchor) || /^0x0{40}$/.test(anchor)) {
    return {
      network,
      status: "unavailable",
      contract: expectedContract,
      contractName: "",
      networkMagic: null,
      checkedAt,
      reason: "resolver-anchor-missing",
    };
  }
  if (anchor !== expectedContract) {
    return {
      network,
      status: "mismatch",
      contract: anchor,
      contractName: "",
      networkMagic: null,
      checkedAt,
      reason: "resolver-anchor-mismatch",
    };
  }
  try {
    const magic = readRpcNetworkMagic(await rpc(getRpcUrl(network), "getversion", [], signal));
    if (magic === null) throw new Error("rpcUnavailable");
    if (magic !== expected.networkMagic) {
      return {
        network,
        status: "mismatch",
        contract: expectedContract,
        contractName: "",
        networkMagic: magic,
        checkedAt,
        reason: "network-mismatch",
      };
    }
    const state = await rpc(getRpcUrl(network), "getcontractstate", [expectedContract], signal);
    const manifest = isRecord(state) && isRecord(state.manifest) ? state.manifest : {};
    const contractName = readBoundedString(manifest.name, 100, { optional: true }) ?? "";
    if (contractName !== "NeoDIDRegistry") {
      return {
        network,
        status: "mismatch",
        contract: expectedContract,
        contractName,
        networkMagic: magic,
        checkedAt,
        reason: "contract-state-mismatch",
      };
    }
    return {
      network,
      status: "verified",
      contract: expectedContract,
      contractName,
      networkMagic: magic,
      checkedAt,
      reason: "verified-deployment",
    };
  } catch (error) {
    if (signal?.aborted) throw error;
    return {
      network,
      status: "unavailable",
      contract: expectedContract,
      contractName: "",
      networkMagic: null,
      checkedAt,
      reason: "rpc-unavailable",
    };
  }
}

function evidenceBase(
  form: NeoDidConsoleForm,
  resolution: ResolvedDidSummary,
  catalog: ProviderCatalogSnapshot,
  registry: NeoDidRegistryProbe,
  createdAt: string,
  expiresAt: string,
) {
  return {
    kind: "oracle.neodid.evidence" as const,
    formatVersion: 1 as const,
    network: registry.network,
    subject: resolution.id,
    createdAt,
    expiresAt,
    resolver: {
      endpoint: didResolveEndpoint(resolution.id, registry.network),
      status: "document-returned" as const,
      contentType: resolution.contentType,
      snapshot: resolution.raw,
    },
    catalog,
    registry,
    didDocument: {
      id: resolution.id,
      controller: resolution.controller,
      versionId: resolution.versionId,
      anchorContract: resolution.anchorContract,
      serviceTypes: resolution.serviceTypes,
      serviceCount: resolution.serviceCount,
      verificationMethodCount: resolution.verificationMethodCount,
      runtimeVerifierMetadata: resolution.runtimeVerifierMetadata ? "available" as const : "unavailable" as const,
      oracleGateway: resolution.oracleGatewayDeclared ? "declared" as const : "not-declared" as const,
    },
    context: observeProviderContext(catalog, form),
    boundaries: {
      identityVerification: "not-performed" as const,
      claimAttestation: "not-performed" as const,
      signatureVerification: "not-performed" as const,
      oracleDispatch: "not-performed" as const,
      providerCatalog: "metadata-only" as const,
    },
  };
}

function registryMatchesResolution(
  probe: NeoDidRegistryProbe,
  resolution: ResolvedDidSummary,
) {
  if (probe.reason === "resolver-anchor-missing") return resolution.anchorContract === "";
  return probe.contract === resolution.anchorContract;
}

export async function buildEvidenceSnapshot(
  form: NeoDidConsoleForm,
  resolution: ResolvedDidSummary,
  catalog: ProviderCatalogSnapshot,
  registry: NeoDidRegistryProbe,
  createdAt = new Date().toISOString(),
): Promise<NeoDidEvidenceSnapshot> {
  const validationKey = validateConsoleForm(form);
  if (validationKey) throw new Error(validationKey);
  if (registry.network !== catalog.network) throw new Error("catalogNetworkMismatch");
  if (canonicalMorpheusDid(form.did) !== resolution.id) throw new Error("resolverSubjectMismatch");
  const checkedResolution = summarizeResolutionPayload(
    resolution.raw,
    resolution.id,
    resolution.contentType,
  );
  if (!isValidCatalog(catalog, registry.network)) throw new Error("catalogFailed");
  if (!isValidRegistryProbe(registry, registry.network)) throw new Error("resolverFailed");
  if (!registryMatchesResolution(registry, checkedResolution)) throw new Error("resolverFailed");
  const timestamp = Date.parse(createdAt);
  if (!Number.isFinite(timestamp)) throw new Error("evidenceTimeInvalid");
  const normalizedCreatedAt = new Date(timestamp).toISOString();
  if (Math.abs(Date.parse(catalog.loadedAt) - timestamp) > 60_000) {
    throw new Error("catalogFailed");
  }
  const expiresAt = new Date(timestamp + EVIDENCE_TTL_MS).toISOString();
  const base = evidenceBase(form, checkedResolution, catalog, registry, normalizedCreatedAt, expiresAt);
  if (byteLength(canonicalize(base)) > MAX_RESPONSE_BYTES * 2) throw new Error("evidenceTooLarge");
  const digest = await sha256Hex(canonicalize(base));
  return { ...base, digest };
}

function isValidRegistryProbe(probe: NeoDidRegistryProbe, network: NeoDidConsoleNetwork) {
  if (!probe || probe.network !== network) return false;
  if (typeof probe.contract !== "string" || typeof probe.contractName !== "string") return false;
  if (CONTROL_PATTERN.test(probe.contractName) || byteLength(probe.contractName) > 100) return false;
  if (probe.contract && (!HASH160_PATTERN.test(probe.contract) || probe.contract !== probe.contract.toLowerCase())) {
    return false;
  }
  if (probe.networkMagic !== null && (!Number.isSafeInteger(probe.networkMagic) || probe.networkMagic < 0)) {
    return false;
  }
  if (probe.status === "idle") {
    return probe.reason === "not-checked" &&
      probe.checkedAt === "" &&
      probe.contract === "" &&
      probe.contractName === "" &&
      probe.networkMagic === null;
  }
  if (!Number.isFinite(Date.parse(probe.checkedAt))) return false;
  const expected = MORPHEUS_PUBLIC_REGISTRY[network];
  const expectedContract = expected.contracts.morpheusNeoDid.toLowerCase();
  if (probe.status === "verified") {
    return probe.reason === "verified-deployment" &&
      probe.contract === expectedContract &&
      probe.contractName === "NeoDIDRegistry" &&
      probe.networkMagic === expected.networkMagic;
  }
  if (probe.status === "unavailable") {
    if (probe.reason === "no-network-deployment") {
      return !expectedContract &&
        !probe.contract &&
        probe.contractName === "" &&
        probe.networkMagic === expected.networkMagic;
    }
    if (probe.reason === "resolver-anchor-missing") {
      return Boolean(expectedContract) &&
        probe.contract === expectedContract &&
        probe.contractName === "" &&
        probe.networkMagic === null;
    }
    if (probe.reason === "rpc-unavailable") {
      return probe.contract === expectedContract &&
        probe.contractName === "" &&
        probe.networkMagic === null;
    }
  }
  if (probe.status === "mismatch") {
    if (probe.reason === "resolver-anchor-mismatch") {
      return HASH160_PATTERN.test(probe.contract) &&
        !/^0x0{40}$/.test(probe.contract) &&
        probe.contract !== expectedContract &&
        probe.contractName === "" &&
        probe.networkMagic === null;
    }
    if (probe.reason === "network-mismatch") {
      return probe.contract === expectedContract &&
        probe.contractName === "" &&
        Number.isSafeInteger(probe.networkMagic) &&
        probe.networkMagic !== expected.networkMagic;
    }
    if (probe.reason === "contract-state-mismatch") {
      return Boolean(expectedContract) &&
        probe.contract === expectedContract &&
        probe.contractName !== "NeoDIDRegistry" &&
        probe.networkMagic === expected.networkMagic;
    }
  }
  return false;
}

function isValidCatalog(catalog: ProviderCatalogSnapshot, network: NeoDidConsoleNetwork) {
  if (!catalog || catalog.network !== network || catalog.endpoint !== providerCatalogEndpoint(network)) return false;
  if (!Number.isFinite(Date.parse(catalog.loadedAt))) return false;
  if (!Array.isArray(catalog.providers)) return false;
  if (catalog.status === "unavailable") {
    return catalog.raw === null &&
      catalog.providers.length === 0 &&
      catalog.source === "unavailable" &&
      catalog.warning === "provider-catalog-unavailable";
  }
  if (!catalog.raw || typeof catalog.raw !== "object" || Array.isArray(catalog.raw)) return false;
  if (catalog.status === "providers-returned" && catalog.providers.length === 0) return false;
  if (catalog.status === "empty-fallback" && catalog.providers.length !== 0) return false;
  const returnedNetwork = explicitConsoleNetwork(catalog.raw.network);
  if (catalog.raw.network && returnedNetwork !== network) return false;
  const derived = catalogFromPayload(catalog.raw, network, catalog.endpoint, catalog.loadedAt);
  return canonicalize({
    status: catalog.status,
    source: catalog.source,
    warning: catalog.warning,
    providers: catalog.providers,
  }) === canonicalize({
    status: derived.status,
    source: derived.source,
    warning: derived.warning,
    providers: derived.providers,
  });
}

export async function restoreEvidenceSnapshot(
  value: unknown,
  network: NeoDidConsoleNetwork,
  now = Date.now(),
): Promise<NeoDidEvidenceSnapshot | null> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  try {
    const candidate = value as NeoDidEvidenceSnapshot;
    const candidateBase = Object.fromEntries(
      Object.entries(candidate).filter(([key]) => key !== "digest"),
    );
    if (byteLength(canonicalize(candidateBase)) > MAX_RESPONSE_BYTES * 2) return null;
    const document = extractDidDocument(candidate.resolver?.snapshot ?? {});
    if (
      candidate.kind !== "oracle.neodid.evidence" ||
      candidate.formatVersion !== 1 ||
      candidate.network !== network ||
      candidate.resolver?.status !== "document-returned" ||
      clean(document.id) !== candidate.subject ||
      candidate.didDocument?.id !== candidate.subject ||
      canonicalMorpheusDid(candidate.subject) !== candidate.subject ||
      candidate.resolver.endpoint !== didResolveEndpoint(candidate.subject, network) ||
      !isValidCatalog(candidate.catalog, network) ||
      !isValidRegistryProbe(candidate.registry, network) ||
      candidate.boundaries?.identityVerification !== "not-performed" ||
      candidate.boundaries?.claimAttestation !== "not-performed" ||
      candidate.boundaries?.signatureVerification !== "not-performed" ||
      candidate.boundaries?.oracleDispatch !== "not-performed" ||
      candidate.boundaries?.providerCatalog !== "metadata-only" ||
      !DIGEST_PATTERN.test(String(candidate.digest ?? "")) ||
      !Number.isFinite(Date.parse(candidate.createdAt)) ||
      !Number.isFinite(Date.parse(candidate.expiresAt)) ||
      Date.parse(candidate.expiresAt) - Date.parse(candidate.createdAt) !== EVIDENCE_TTL_MS ||
      Math.abs(Date.parse(candidate.catalog.loadedAt) - Date.parse(candidate.createdAt)) > 60_000 ||
      (candidate.registry.status !== "idle" &&
        Math.abs(Date.parse(candidate.registry.checkedAt) - Date.parse(candidate.createdAt)) > 60_000) ||
      Date.parse(candidate.createdAt) > now + 60_000 ||
      Date.parse(candidate.expiresAt) <= now
    ) return null;

    const form: NeoDidConsoleForm = {
      did: candidate.subject,
      provider: candidate.context.requestedProvider,
      claim: candidate.context.requestedClaim,
    };
    if (validateConsoleForm(form)) return null;
    const resolution = summarizeResolutionPayload(
      candidate.resolver.snapshot,
      candidate.subject,
      candidate.resolver.contentType,
    );
    const rebuilt = evidenceBase(
      form,
      resolution,
      candidate.catalog,
      candidate.registry,
      candidate.createdAt,
      candidate.expiresAt,
    );
    const digest = await sha256Hex(canonicalize(rebuilt));
    return digest === candidate.digest ? { ...rebuilt, digest } : null;
  } catch {
    return null;
  }
}

export function buildPendingOperation(
  network: NeoDidConsoleNetwork,
  form: NeoDidConsoleForm,
  startedAt = new Date().toISOString(),
): NeoDidPendingOperation {
  if (validateConsoleForm(form)) throw new Error("invalidPendingOperation");
  if (!Number.isFinite(Date.parse(startedAt))) throw new Error("invalidPendingOperation");
  return {
    version: 1,
    network,
    phase: "resolving",
    form: {
      did: canonicalMorpheusDid(form.did) ?? form.did,
      provider: form.provider,
      claim: form.claim,
    },
    startedAt: new Date(Date.parse(startedAt)).toISOString(),
  };
}

export function restorePendingOperation(
  value: unknown,
  network: NeoDidConsoleNetwork,
  now = Date.now(),
): NeoDidPendingOperation | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  try {
    const candidate = value as NeoDidPendingOperation;
    const startedAt = Date.parse(candidate.startedAt);
    if (
      candidate.version !== 1 ||
      candidate.network !== network ||
      candidate.phase !== "resolving" ||
      !Number.isFinite(startedAt) ||
      startedAt > now + 60_000 ||
      now - startedAt > PENDING_TTL_MS
    ) return null;
    return buildPendingOperation(network, candidate.form, candidate.startedAt);
  } catch {
    return null;
  }
}

export function evidenceMatchesForm(
  evidence: NeoDidEvidenceSnapshot,
  form: NeoDidConsoleForm,
) {
  return evidence.subject === canonicalMorpheusDid(form.did) &&
    evidence.context.requestedProvider === form.provider &&
    evidence.context.requestedClaim === form.claim;
}

export function serializeEvidence(evidence: NeoDidEvidenceSnapshot) {
  return JSON.stringify(evidence, null, 2);
}

export function shortDigest(value: string) {
  if (!value) return "";
  return value.length <= 20 ? value : `${value.slice(0, 10)}…${value.slice(-8)}`;
}
