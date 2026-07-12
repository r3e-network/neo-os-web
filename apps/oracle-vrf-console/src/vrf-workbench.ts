import {
  EXTERNAL_INTEGRATIONS,
  type NeoNetwork,
} from "@shared/constants/rpc";

export const VRF_RESPONSE_LIMIT = 64 * 1024;
export const VRF_REQUEST_TARGET = "neo_n3";
export const VRF_METHOD = "csprng-signed";

export type VrfPurpose = "game" | "raffle" | "allocation";
export type ServiceAvailability =
  | "protected"
  | "network-mismatch"
  | "degraded"
  | "unavailable";

export interface VrfEnvironment {
  network: NeoNetwork;
  networkLabel: string;
  apiBaseUrl: string;
  rpcUrl: string;
  requestEndpoint: string;
  oracleContract: string;
  callbackConsumer: string;
  responseSignerKey: string;
  fulfillmentVerifierKey: string;
}

export interface VrfRequestDraft {
  kind: "morpheus.vrf.request-draft";
  version: 1;
  network: NeoNetwork;
  createdAt: string;
  status: "draft-not-submitted";
  endpoint: string;
  method: "POST";
  request: {
    request_id: string;
    target_chain: typeof VRF_REQUEST_TARGET;
  };
  context: {
    consumer: string;
    reference: string;
    purpose: VrfPurpose;
  };
  submission: {
    mode: "authenticated-consumer-integration";
    dispatched: false;
  };
}

export interface VrfServiceSnapshot {
  network: NeoNetwork;
  freshness: "live" | "stale";
  availability: ServiceAvailability;
  checkedAt: string;
  apiBaseUrl: string;
  requestEndpoint: string;
  rpcUrl: string;
  reportedNetwork: string;
  healthReady: boolean;
  runtimeOperational: boolean;
  workflowAdvertised: boolean;
  dispatchMode: "authenticated-consumer-integration";
  apiVerifierKey: string;
  healthVerifierKey: string;
  contractVerifierKey: string;
  responseSignerKey: string;
  responseSignerPinned: boolean;
  registryFulfillmentKey: string;
  keysMatch: boolean;
  runtimeKeyMatches: boolean;
  oracleContract: string;
  oracleContractName: string;
  oracleChecksum: number | null;
  callbackConsumer: string;
  callbackContractName: string;
  callbackChecksum: number | null;
  callbackBound: boolean;
  totalRequests: number | null;
  totalFulfilled: number | null;
  pendingRequests: number | null;
  requestFeeGas: number | null;
  errors: string[];
}

export type VerificationCheckKey =
  | "schema"
  | "request"
  | "method"
  | "network-key"
  | "output-hash"
  | "signature"
  | "attestation";

export interface VrfVerificationCheck {
  key: VerificationCheckKey;
  status: "pass" | "fail" | "info";
}

export interface VrfVerificationResult {
  status: "verified" | "unbound" | "invalid" | "blocked";
  reason:
    | "ok"
    | "service-key-unavailable"
    | "response-too-large"
    | "invalid-json"
    | "invalid-schema"
    | "request-mismatch"
    | "unsupported-method"
    | "signer-mismatch"
    | "hash-mismatch"
    | "signature-invalid";
  requestId: string;
  randomness: string;
  outputHash: string;
  signerKey: string;
  verifiedAt: string;
  requestCorrelationSigned: false;
  attestation:
    | "not-provided"
    | "hash-bound-not-independently-verified";
  checks: VrfVerificationCheck[];
}

type FetchLike = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

type JsonRecord = Record<string, unknown>;

const PURPOSES = new Set<VrfPurpose>(["game", "raffle", "allocation"]);
const SERVICE_AVAILABILITY = new Set<ServiceAvailability>([
  "protected",
  "network-mismatch",
  "degraded",
  "unavailable",
]);
const HEX_32 = /^[0-9a-f]{64}$/;
const HEX_SIGNATURE = /^[0-9a-f]{128}$/;
const COMPRESSED_PUBLIC_KEY = /^(02|03)[0-9a-f]{64}$/;
const SCRIPT_HASH = /^0x[0-9a-f]{40}$/;
const REQUEST_NONCE = /^[a-z0-9._-]{1,72}$/;

export function getVrfEnvironment(network: NeoNetwork): VrfEnvironment {
  const integration = EXTERNAL_INTEGRATIONS[network];
  const apiBaseUrl = integration.morpheusPublicApiUrl.replace(/\/$/, "");
  return {
    network,
    networkLabel: network === "testnet" ? "Neo N3 Testnet" : "Neo N3 Mainnet",
    apiBaseUrl,
    rpcUrl: integration.rpcUrl,
    requestEndpoint: `${apiBaseUrl}/vrf/random`,
    oracleContract: integration.contracts.morpheusOracle.toLowerCase(),
    callbackConsumer: String(integration.contracts.oracleCallbackConsumer ?? "").toLowerCase(),
    responseSignerKey: integration.morpheusWorkerSignerPublicKey.toLowerCase(),
    fulfillmentVerifierKey: integration.morpheusOracleVerifierPublicKey.toLowerCase(),
  };
}

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as JsonRecord
    : null;
}

function cleanText(value: unknown, fallback: string, maxLength: number): string {
  const cleaned = String(value ?? "").trim().replace(/\s+/g, " ");
  return (cleaned || fallback).slice(0, maxLength);
}

function slug(value: string, fallback: string): string {
  const cleaned = value
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 36);
  return cleaned || fallback;
}

function newRequestNonce(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  if (typeof globalThis.crypto?.getRandomValues !== "function") {
    throw new Error("secureNonceUnavailable");
  }
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function buildVrfRequestDraft(
  input: Partial<VrfRequestDraft["context"]>,
  network: NeoNetwork,
  options: { nonce?: () => string; now?: () => Date } = {},
): VrfRequestDraft {
  const environment = getVrfEnvironment(network);
  const consumer = cleanText(input.consumer, "miniapp-oracle-vrf-console", 72);
  const reference = cleanText(input.reference, "randomness-session", 96);
  const purpose = PURPOSES.has(input.purpose as VrfPurpose)
    ? input.purpose as VrfPurpose
    : "game";
  const nonce = slug(
    cleanText((options.nonce ?? newRequestNonce)(), "request", 72),
    "request",
  );
  const requestId = `vrf:${network}:${slug(consumer, "consumer")}:${nonce}`;

  return {
    kind: "morpheus.vrf.request-draft",
    version: 1,
    network,
    createdAt: (options.now ?? (() => new Date()))().toISOString(),
    status: "draft-not-submitted",
    endpoint: environment.requestEndpoint,
    method: "POST",
    request: {
      request_id: requestId,
      target_chain: VRF_REQUEST_TARGET,
    },
    context: { consumer, reference, purpose },
    submission: {
      mode: "authenticated-consumer-integration",
      dispatched: false,
    },
  };
}

export function restoreVrfRequestDraft(
  value: unknown,
  network: NeoNetwork,
): VrfRequestDraft | null {
  const draft = asRecord(value);
  const request = asRecord(draft?.request);
  const context = asRecord(draft?.context);
  const submission = asRecord(draft?.submission);
  const environment = getVrfEnvironment(network);
  const purpose = typeof context?.purpose === "string"
    ? context.purpose as VrfPurpose
    : "" as VrfPurpose;
  const createdAt = typeof draft?.createdAt === "string" ? draft.createdAt : "";
  const consumer = typeof context?.consumer === "string" ? context.consumer : "";
  const reference = typeof context?.reference === "string" ? context.reference : "";
  const requestId = typeof request?.request_id === "string" ? request.request_id : "";
  const requestPrefix = `vrf:${network}:${slug(consumer, "consumer")}:`;
  const nonce = requestId.startsWith(requestPrefix)
    ? requestId.slice(requestPrefix.length)
    : "";

  if (
    draft?.kind !== "morpheus.vrf.request-draft"
    || draft.version !== 1
    || draft.network !== network
    || draft.status !== "draft-not-submitted"
    || draft.endpoint !== environment.requestEndpoint
    || draft.method !== "POST"
    || request?.target_chain !== VRF_REQUEST_TARGET
    || !requestId.startsWith(requestPrefix)
    || requestId.length > 196
    || !REQUEST_NONCE.test(nonce)
    || !PURPOSES.has(purpose)
    || !consumer
    || cleanText(consumer, "", 72) !== consumer
    || !reference
    || cleanText(reference, "", 96) !== reference
    || submission?.mode !== "authenticated-consumer-integration"
    || submission.dispatched !== false
    || !Number.isFinite(Date.parse(createdAt))
    || new Date(createdAt).toISOString() !== createdAt
  ) {
    return null;
  }

  return {
    kind: "morpheus.vrf.request-draft",
    version: 1,
    network,
    createdAt,
    status: "draft-not-submitted",
    endpoint: environment.requestEndpoint,
    method: "POST",
    request: {
      request_id: requestId,
      target_chain: VRF_REQUEST_TARGET,
    },
    context: { consumer, reference, purpose },
    submission: {
      mode: "authenticated-consumer-integration",
      dispatched: false,
    },
  };
}

export function restoreVrfResponseText(value: unknown): string {
  const text = typeof value === "string" ? value.trim() : "";
  return text.length > 0 && text.length <= VRF_RESPONSE_LIMIT ? text : "";
}

function normalizeHex(value: unknown): string {
  return typeof value === "string"
    ? value.trim().replace(/^0x/i, "").toLowerCase()
    : "";
}

function exactSafeUnsignedInteger(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isSafeInteger(value) && value >= 0 ? value : null;
  }
  if (typeof value !== "string" || !/^(0|[1-9]\d*)$/.test(value)) return null;
  try {
    const parsed = BigInt(value);
    return parsed <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(parsed) : null;
  } catch {
    return null;
  }
}

function base64Bytes(value: string): Uint8Array {
  const decoded = globalThis.atob(value);
  return Uint8Array.from(decoded, (char) => char.charCodeAt(0));
}

function base64PublicKey(value: unknown): string {
  try {
    return Array.from(base64Bytes(String(value ?? "")), (byte) =>
      byte.toString(16).padStart(2, "0")
    ).join("");
  } catch {
    return "";
  }
}

function base64ScriptHash(value: unknown): string {
  try {
    const bytes = Array.from(base64Bytes(String(value ?? ""))).reverse();
    return `0x${bytes.map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
  } catch {
    return "";
  }
}

async function fetchJson(
  url: string,
  fetcher: FetchLike,
  init: RequestInit = {},
): Promise<unknown> {
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetcher(url, {
      ...init,
      headers: {
        accept: "application/json",
        ...init.headers,
      },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    globalThis.clearTimeout(timeout);
  }
}

function rpcStackValue(responses: Map<string, JsonRecord>, id: string): unknown {
  const response = responses.get(id);
  const result = asRecord(response?.result);
  const stack = Array.isArray(result?.stack) ? result.stack : [];
  const first = asRecord(stack[0]);
  return result?.state === "HALT" ? first?.value : undefined;
}

function contractState(responses: Map<string, JsonRecord>, id: string) {
  const response = responses.get(id);
  const result = asRecord(response?.result);
  const manifest = asRecord(result?.manifest);
  const nef = asRecord(result?.nef);
  return {
    name: String(manifest?.name ?? ""),
    checksum: exactSafeUnsignedInteger(nef?.checksum),
  };
}

async function probeChain(
  environment: VrfEnvironment,
  fetcher: FetchLike,
) {
  const payload = [
    {
      jsonrpc: "2.0",
      id: "oracle-state",
      method: "getcontractstate",
      params: [environment.oracleContract],
    },
    {
      jsonrpc: "2.0",
      id: "callback-state",
      method: "getcontractstate",
      params: [environment.callbackConsumer],
    },
    ...[
      ["total", environment.oracleContract, "getTotalRequests"],
      ["fulfilled", environment.oracleContract, "getTotalFulfilled"],
      ["fee", environment.oracleContract, "requestFee"],
      ["verifier", environment.oracleContract, "oracleVerificationPublicKey"],
      ["callback-oracle", environment.callbackConsumer, "oracle"],
    ].map(([id, contract, method]) => ({
      jsonrpc: "2.0",
      id,
      method: "invokefunction",
      params: [contract, method, []],
    })),
  ];
  const raw = await fetchJson(environment.rpcUrl, fetcher, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!Array.isArray(raw)) throw new Error("RPC batch response missing");
  const responses = new Map<string, JsonRecord>();
  for (const item of raw) {
    const record = asRecord(item);
    if (record) responses.set(String(record.id ?? ""), record);
  }
  const totalRequests = exactSafeUnsignedInteger(rpcStackValue(responses, "total"));
  const totalFulfilled = exactSafeUnsignedInteger(rpcStackValue(responses, "fulfilled"));
  const requestFee = exactSafeUnsignedInteger(rpcStackValue(responses, "fee"));
  const oracleState = contractState(responses, "oracle-state");
  const callbackState = contractState(responses, "callback-state");
  const contractVerifierKey = base64PublicKey(rpcStackValue(responses, "verifier"));
  const callbackOracle = base64ScriptHash(rpcStackValue(responses, "callback-oracle"));
  const evidenceErrors: string[] = [];
  if (!COMPRESSED_PUBLIC_KEY.test(contractVerifierKey)) evidenceErrors.push("oracle-contract-key");
  if (!SCRIPT_HASH.test(callbackOracle)) evidenceErrors.push("callback-binding");
  if (!oracleState.name || oracleState.checksum == null) evidenceErrors.push("oracle-contract-state");
  if (!callbackState.name || callbackState.checksum == null) evidenceErrors.push("callback-contract-state");
  if (totalRequests == null) evidenceErrors.push("request-counter");
  if (totalFulfilled == null) evidenceErrors.push("fulfilled-counter");
  if (requestFee == null) evidenceErrors.push("request-fee");
  if (
    totalRequests != null
    && totalFulfilled != null
    && totalFulfilled > totalRequests
  ) {
    evidenceErrors.push("request-counter-order");
  }
  return {
    contractVerifierKey,
    callbackOracle,
    totalRequests,
    totalFulfilled,
    requestFeeGas: requestFee == null ? null : requestFee / 100_000_000,
    oracleState,
    callbackState,
    evidenceErrors,
  };
}

function settledRecord(
  result: PromiseSettledResult<unknown>,
  label: string,
  errors: string[],
): JsonRecord | null {
  if (result.status === "fulfilled") return asRecord(result.value);
  errors.push(label);
  return null;
}

interface VrfServiceEvidence {
  health: JsonRecord | null;
  runtimeStatus: JsonRecord | null;
  key: JsonRecord | null;
  errors: string[];
}

async function readDirectServiceEvidence(
  environment: VrfEnvironment,
  fetcher: FetchLike,
): Promise<VrfServiceEvidence> {
  const [healthResult, statusResult, keyResult] = await Promise.allSettled([
    fetchJson(`${environment.apiBaseUrl}/health`, fetcher),
    fetchJson(`${environment.apiBaseUrl}/v1/status`, fetcher),
    fetchJson(`${environment.apiBaseUrl}/oracle/public-key`, fetcher),
  ]);
  const errors: string[] = [];
  return {
    health: settledRecord(healthResult, "health", errors),
    runtimeStatus: settledRecord(statusResult, "runtime-status", errors),
    key: settledRecord(keyResult, "oracle-key", errors),
    errors,
  };
}

async function readServiceEvidence(
  environment: VrfEnvironment,
  fetcher: FetchLike,
): Promise<VrfServiceEvidence> {
  if (typeof window !== "undefined") {
    try {
      const bundle = asRecord(await fetchJson(
        `/api/morpheus/vrf/status?network=${encodeURIComponent(environment.network)}`,
        fetcher,
      ));
      if (bundle?.network === environment.network) {
        const errors = Array.isArray(bundle.errors)
          ? bundle.errors.map((value) => String(value))
          : [];
        return {
          health: asRecord(bundle.health),
          runtimeStatus: asRecord(bundle.status),
          key: asRecord(bundle.key),
          errors,
        };
      }
    } catch {
      // Local Vite previews do not serve the host API. Fall back to direct
      // public reads; browsers that enforce upstream CORS will still retain
      // the independently fetched Neo N3 contract evidence below.
    }
  }
  return readDirectServiceEvidence(environment, fetcher);
}

export async function probeVrfService(
  network: NeoNetwork,
  fetcher: FetchLike = globalThis.fetch.bind(globalThis),
): Promise<VrfServiceSnapshot> {
  const environment = getVrfEnvironment(network);
  const [serviceResult, chainResult] = await Promise.allSettled([
    readServiceEvidence(environment, fetcher),
    probeChain(environment, fetcher),
  ]);
  const evidence = serviceResult.status === "fulfilled"
    ? serviceResult.value
    : { health: null, runtimeStatus: null, key: null, errors: ["service-status"] };
  const errors = [...evidence.errors];
  const { health, runtimeStatus, key } = evidence;
  const chain = chainResult.status === "fulfilled" ? chainResult.value : null;
  if (!chain) errors.push("neo-rpc");
  else errors.push(...chain.evidenceErrors);

  const healthChecks = asRecord(health?.checks);
  const runtime = asRecord(runtimeStatus?.runtime);
  const catalog = asRecord(runtimeStatus?.catalog);
  const workflows = asRecord(catalog?.workflows);
  const workflowIds = Array.isArray(workflows?.ids)
    ? workflows.ids.map((value) => String(value))
    : [];
  const keySource = asRecord(key?.source);
  const apiVerifierKey = normalizeHex(key?.verification_public_key);
  const healthVerifierKey = normalizeHex(healthChecks?.oracle_verifier_public_key);
  const contractVerifierKey = normalizeHex(chain?.contractVerifierKey);
  const responseSignerKey = normalizeHex(environment.responseSignerKey);
  const registryFulfillmentKey = normalizeHex(environment.fulfillmentVerifierKey);
  const apiKeyMatches = !apiVerifierKey || Boolean(
    apiVerifierKey === contractVerifierKey
    && keySource?.network === network
    && normalizeHex(keySource?.oracle_contract) === normalizeHex(environment.oracleContract)
  );
  const keysMatch = Boolean(
    COMPRESSED_PUBLIC_KEY.test(contractVerifierKey)
    && contractVerifierKey === registryFulfillmentKey
    && apiKeyMatches,
  );
  const responseSignerPinned = COMPRESSED_PUBLIC_KEY.test(responseSignerKey);
  const runtimeKeyMatches = Boolean(
    COMPRESSED_PUBLIC_KEY.test(healthVerifierKey)
    && healthVerifierKey === contractVerifierKey,
  );
  const callbackBound = Boolean(
    environment.callbackConsumer
    && normalizeHex(chain?.callbackOracle) === normalizeHex(environment.oracleContract),
  );
  const healthReady = health?.ready === true && health?.status === "ok";
  const runtimeOperational = runtime?.status === "operational";
  const reportedNetwork = typeof health?.network === "string" ? health.network : "";
  const workflowAdvertised = workflowIds.some((id) => id.toLowerCase().includes("vrf"));
  const networkMismatch = Boolean(
    (reportedNetwork && reportedNetwork !== network)
    || (contractVerifierKey && healthVerifierKey && !runtimeKeyMatches),
  );
  const serviceReachable = Boolean(health && runtimeStatus && key);
  const chainReachable = Boolean(chain && contractVerifierKey);
  if (!responseSignerPinned) errors.push("response-signer-registry");

  let availability: ServiceAvailability = "protected";
  if (!serviceReachable && !chainReachable) availability = "unavailable";
  else if (networkMismatch) availability = "network-mismatch";
  else if (
    !healthReady
    || !runtimeOperational
    || !keysMatch
    || !runtimeKeyMatches
    || !callbackBound
    || errors.length > 0
  ) {
    availability = "degraded";
  }

  const totalRequests = chain?.totalRequests ?? null;
  const totalFulfilled = chain?.totalFulfilled ?? null;
  const pendingRequests = totalRequests != null
    && totalFulfilled != null
    && totalFulfilled <= totalRequests
    ? totalRequests - totalFulfilled
    : null;

  return {
    network,
    freshness: "live",
    availability,
    checkedAt: new Date().toISOString(),
    apiBaseUrl: environment.apiBaseUrl,
    requestEndpoint: environment.requestEndpoint,
    rpcUrl: environment.rpcUrl,
    reportedNetwork,
    healthReady,
    runtimeOperational,
    workflowAdvertised,
    dispatchMode: "authenticated-consumer-integration",
    apiVerifierKey,
    healthVerifierKey,
    contractVerifierKey,
    responseSignerKey,
    responseSignerPinned,
    registryFulfillmentKey,
    keysMatch,
    runtimeKeyMatches,
    oracleContract: environment.oracleContract,
    oracleContractName: chain?.oracleState.name ?? "",
    oracleChecksum: chain?.oracleState.checksum ?? null,
    callbackConsumer: environment.callbackConsumer,
    callbackContractName: chain?.callbackState.name ?? "",
    callbackChecksum: chain?.callbackState.checksum ?? null,
    callbackBound,
    totalRequests,
    totalFulfilled,
    pendingRequests,
    requestFeeGas: chain?.requestFeeGas ?? null,
    errors: [...new Set(errors)],
  };
}

export function markVrfServiceSnapshotStale(
  value: unknown,
  network: NeoNetwork,
): VrfServiceSnapshot | null {
  const snapshot = asRecord(value);
  const environment = getVrfEnvironment(network);
  const checkedAt = typeof snapshot?.checkedAt === "string" ? snapshot.checkedAt : "";
  const availability = typeof snapshot?.availability === "string"
    ? snapshot.availability as ServiceAvailability
    : "unavailable";
  const reportedNetwork = typeof snapshot?.reportedNetwork === "string"
    ? snapshot.reportedNetwork.slice(0, 32)
    : "";
  const rawApiVerifierKey = normalizeHex(snapshot?.apiVerifierKey);
  const rawHealthVerifierKey = normalizeHex(snapshot?.healthVerifierKey);
  const apiVerifierKey = COMPRESSED_PUBLIC_KEY.test(rawApiVerifierKey)
    ? rawApiVerifierKey
    : "";
  const healthVerifierKey = COMPRESSED_PUBLIC_KEY.test(rawHealthVerifierKey)
    ? rawHealthVerifierKey
    : "";
  const contractVerifierKey = normalizeHex(snapshot?.contractVerifierKey);
  const responseSignerKey = normalizeHex(snapshot?.responseSignerKey);
  const registryFulfillmentKey = normalizeHex(snapshot?.registryFulfillmentKey);
  const oracleChecksum = snapshot?.oracleChecksum == null
    ? null
    : exactSafeUnsignedInteger(snapshot.oracleChecksum);
  const callbackChecksum = snapshot?.callbackChecksum == null
    ? null
    : exactSafeUnsignedInteger(snapshot.callbackChecksum);
  const totalRequests = snapshot?.totalRequests == null
    ? null
    : exactSafeUnsignedInteger(snapshot.totalRequests);
  const totalFulfilled = snapshot?.totalFulfilled == null
    ? null
    : exactSafeUnsignedInteger(snapshot.totalFulfilled);
  const pendingRequests = snapshot?.pendingRequests == null
    ? null
    : exactSafeUnsignedInteger(snapshot.pendingRequests);
  const requestFeeGas = typeof snapshot?.requestFeeGas === "number"
    && Number.isFinite(snapshot.requestFeeGas)
    && snapshot.requestFeeGas >= 0
    ? snapshot.requestFeeGas
    : null;
  const rawErrors = Array.isArray(snapshot?.errors) ? snapshot.errors : [];
  const errors = rawErrors
    .filter((entry): entry is string => typeof entry === "string" && entry.length <= 64)
    .slice(0, 24);
  if (
    !snapshot
    || snapshot.network !== network
    || typeof snapshot.availability !== "string"
    || !SERVICE_AVAILABILITY.has(availability)
    || !Number.isFinite(Date.parse(checkedAt))
    || snapshot.apiBaseUrl !== environment.apiBaseUrl
    || snapshot.requestEndpoint !== environment.requestEndpoint
    || snapshot.rpcUrl !== environment.rpcUrl
    || snapshot.dispatchMode !== "authenticated-consumer-integration"
    || typeof snapshot.healthReady !== "boolean"
    || typeof snapshot.runtimeOperational !== "boolean"
    || typeof snapshot.workflowAdvertised !== "boolean"
    || typeof snapshot.keysMatch !== "boolean"
    || typeof snapshot.runtimeKeyMatches !== "boolean"
    || typeof snapshot.callbackBound !== "boolean"
    || typeof snapshot.apiVerifierKey !== "string"
    || typeof snapshot.healthVerifierKey !== "string"
    || typeof snapshot.contractVerifierKey !== "string"
    || !COMPRESSED_PUBLIC_KEY.test(contractVerifierKey)
    || typeof snapshot.responseSignerKey !== "string"
    || !COMPRESSED_PUBLIC_KEY.test(responseSignerKey)
    || responseSignerKey !== environment.responseSignerKey
    || snapshot.responseSignerPinned !== true
    || typeof snapshot.registryFulfillmentKey !== "string"
    || registryFulfillmentKey !== environment.fulfillmentVerifierKey
    || snapshot.oracleContract !== environment.oracleContract
    || snapshot.callbackConsumer !== environment.callbackConsumer
    || typeof snapshot.oracleContractName !== "string"
    || snapshot.oracleContractName.length > 120
    || typeof snapshot.callbackContractName !== "string"
    || snapshot.callbackContractName.length > 120
    || (snapshot.oracleChecksum != null && oracleChecksum == null)
    || (snapshot.callbackChecksum != null && callbackChecksum == null)
    || (snapshot.totalRequests != null && totalRequests == null)
    || (snapshot.totalFulfilled != null && totalFulfilled == null)
    || (snapshot.pendingRequests != null && pendingRequests == null)
    || (snapshot.requestFeeGas != null && requestFeeGas == null)
    || (totalRequests != null && totalFulfilled != null && totalFulfilled > totalRequests)
    || (pendingRequests != null
      && totalRequests != null
      && totalFulfilled != null
      && pendingRequests !== totalRequests - totalFulfilled)
    || rawErrors.length !== errors.length
  ) {
    return null;
  }
  return {
    network,
    freshness: "stale",
    availability,
    checkedAt,
    apiBaseUrl: environment.apiBaseUrl,
    requestEndpoint: environment.requestEndpoint,
    rpcUrl: environment.rpcUrl,
    reportedNetwork,
    healthReady: snapshot.healthReady,
    runtimeOperational: snapshot.runtimeOperational,
    workflowAdvertised: snapshot.workflowAdvertised,
    dispatchMode: "authenticated-consumer-integration",
    apiVerifierKey,
    healthVerifierKey,
    contractVerifierKey,
    responseSignerKey,
    responseSignerPinned: true,
    registryFulfillmentKey,
    keysMatch: snapshot.keysMatch,
    runtimeKeyMatches: snapshot.runtimeKeyMatches,
    oracleContract: environment.oracleContract,
    oracleContractName: snapshot.oracleContractName,
    oracleChecksum,
    callbackConsumer: environment.callbackConsumer,
    callbackContractName: snapshot.callbackContractName,
    callbackChecksum,
    callbackBound: snapshot.callbackBound,
    totalRequests,
    totalFulfilled,
    pendingRequests,
    requestFeeGas,
    errors: [...new Set([...errors, "stale-cache"])],
  };
}

const STABLE_KEY_COLLATOR = new Intl.Collator("en", {
  sensitivity: "variant",
  caseFirst: "false",
});

/** Canonical serializer used by the Morpheus signed-result envelope. */
export function stableStringify(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value === "bigint") return JSON.stringify(value.toString());
  if (typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  const entries = Object.entries(value as JsonRecord)
    .filter(([, entryValue]) => entryValue !== undefined)
    .sort(([a], [b]) => STABLE_KEY_COLLATOR.compare(a, b));
  return `{${entries.map(([key, entryValue]) =>
    `${JSON.stringify(key)}:${stableStringify(entryValue)}`
  ).join(",")}}`;
}

function hexBytes(value: string): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(value.length / 2);
  for (let index = 0; index < value.length; index += 2) {
    bytes[index / 2] = Number.parseInt(value.slice(index, index + 2), 16);
  }
  return bytes as Uint8Array<ArrayBuffer>;
}

async function verifyP256Signature(
  canonicalPayload: string,
  signature: string,
  publicKey: string,
): Promise<boolean> {
  const key = await globalThis.crypto.subtle.importKey(
    "raw",
    hexBytes(publicKey),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["verify"],
  );
  return globalThis.crypto.subtle.verify(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    hexBytes(signature),
    new TextEncoder().encode(canonicalPayload),
  );
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
}

function verificationResult(
  status: VrfVerificationResult["status"],
  reason: VrfVerificationResult["reason"],
  overrides: Partial<VrfVerificationResult> = {},
): VrfVerificationResult {
  return {
    status,
    reason,
    requestId: "",
    randomness: "",
    outputHash: "",
    signerKey: "",
    verifiedAt: new Date().toISOString(),
    requestCorrelationSigned: false,
    attestation: "not-provided",
    checks: [],
    ...overrides,
  };
}

export async function verifyVrfResponse(
  responseText: string,
  draft: VrfRequestDraft | null,
  snapshot: VrfServiceSnapshot | null,
): Promise<VrfVerificationResult> {
  if (
    !snapshot
    || !snapshot.responseSignerPinned
    || !COMPRESSED_PUBLIC_KEY.test(snapshot.responseSignerKey)
    || (draft != null && draft.network !== snapshot.network)
  ) {
    return verificationResult("blocked", "service-key-unavailable", {
      checks: [{ key: "network-key", status: "fail" }],
    });
  }
  const trimmed = responseText.trim();
  if (!trimmed || trimmed.length > VRF_RESPONSE_LIMIT) {
    return verificationResult("invalid", trimmed ? "response-too-large" : "invalid-json", {
      checks: [{ key: "schema", status: "fail" }],
    });
  }

  let parsed: JsonRecord;
  try {
    const value = JSON.parse(trimmed) as unknown;
    const record = asRecord(value);
    if (!record) throw new Error("response is not an object");
    parsed = record;
  } catch {
    return verificationResult("invalid", "invalid-json", {
      checks: [{ key: "schema", status: "fail" }],
    });
  }

  const envelope = asRecord(parsed.verification);
  const requestId = typeof parsed.request_id === "string"
    ? parsed.request_id.trim()
    : "";
  const randomness = normalizeHex(parsed.randomness);
  const outputHash = normalizeHex(parsed.output_hash);
  const attestationHash = normalizeHex(parsed.attestation_hash);
  const signerKey = normalizeHex(parsed.public_key);
  const signature = normalizeHex(parsed.signature);
  const method = typeof parsed.vrf_method === "string" ? parsed.vrf_method : "";
  const timestamp = parsed.timestamp;
  const envelopeOutputHash = normalizeHex(envelope?.output_hash);
  const envelopeAttestationHash = normalizeHex(envelope?.attestation_hash);
  const envelopeSignerKey = normalizeHex(envelope?.public_key);
  const envelopeSignature = normalizeHex(envelope?.signature);
  const teeAttestation = parsed.tee_attestation ?? envelope?.tee_attestation;

  const schemaValid = Boolean(
    requestId
    && HEX_32.test(randomness)
    && HEX_32.test(outputHash)
    && HEX_32.test(attestationHash)
    && COMPRESSED_PUBLIC_KEY.test(signerKey)
    && HEX_SIGNATURE.test(signature)
    && typeof timestamp === "number"
    && Number.isSafeInteger(timestamp)
    && timestamp > 0
    && envelope
    && envelopeOutputHash === outputHash
    && envelopeAttestationHash === attestationHash
    && envelopeSignerKey === signerKey
    && envelopeSignature === signature,
  );
  if (!schemaValid) {
    return verificationResult("invalid", "invalid-schema", {
      requestId,
      randomness,
      outputHash,
      signerKey,
      checks: [{ key: "schema", status: "fail" }],
    });
  }

  const checks: VrfVerificationCheck[] = [{ key: "schema", status: "pass" }];
  if (method !== VRF_METHOD) {
    checks.push({ key: "method", status: "fail" });
    return verificationResult("invalid", "unsupported-method", {
      requestId,
      randomness,
      outputHash,
      signerKey,
      checks,
    });
  }
  checks.push({ key: "method", status: "pass" });

  const pinnedKey = normalizeHex(snapshot.responseSignerKey);
  if (signerKey !== pinnedKey) {
    checks.push({ key: "network-key", status: "fail" });
    return verificationResult("invalid", "signer-mismatch", {
      requestId,
      randomness,
      outputHash,
      signerKey,
      checks,
    });
  }
  checks.push({ key: "network-key", status: "pass" });

  const canonicalPayload = stableStringify({ randomness });
  const computedHash = await sha256Hex(canonicalPayload);
  if (
    computedHash !== outputHash
    || attestationHash !== outputHash
  ) {
    checks.push({ key: "output-hash", status: "fail" });
    return verificationResult("invalid", "hash-mismatch", {
      requestId,
      randomness,
      outputHash,
      signerKey,
      checks,
    });
  }
  checks.push({ key: "output-hash", status: "pass" });

  let signatureValid = false;
  try {
    signatureValid = await verifyP256Signature(canonicalPayload, signature, signerKey);
  } catch {
    signatureValid = false;
  }
  if (!signatureValid) {
    checks.push({ key: "signature", status: "fail" });
    return verificationResult("invalid", "signature-invalid", {
      requestId,
      randomness,
      outputHash,
      signerKey,
      checks,
    });
  }
  checks.push({ key: "signature", status: "pass" });

  const attestation = teeAttestation == null
    ? "not-provided"
    : "hash-bound-not-independently-verified";
  checks.push({ key: "attestation", status: "info" });
  const requestMatches = Boolean(draft && requestId === draft.request.request_id);
  checks.push({ key: "request", status: requestMatches ? "pass" : "fail" });
  if (!requestMatches) {
    return verificationResult("unbound", "request-mismatch", {
      requestId,
      randomness,
      outputHash,
      signerKey,
      attestation,
      checks,
    });
  }

  return verificationResult("verified", "ok", {
    requestId,
    randomness,
    outputHash,
    signerKey,
    attestation,
    checks,
  });
}

export function shortValue(value: string, head = 10, tail = 6): string {
  const text = String(value ?? "").trim();
  if (text.length <= head + tail + 3) return text;
  return `${text.slice(0, head)}…${text.slice(-tail)}`;
}
