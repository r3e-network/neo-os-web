import { getExternalIntegrationConfig, getNetwork, type NeoNetwork } from "@shared/constants/rpc";
import { MORPHEUS_PUBLIC_RUNTIME_CATALOG } from "@shared/constants/generated-morpheus-runtime-catalog";
import { sha256Hex } from "@shared/utils/hash";

export const COMPUTE_WORKFLOW_ID = "compute.execute" as const;
export const LOCAL_PACKAGE_VERSION = "oracle-compute-lab/local-review-v2" as const;
export const REQUEST_DIGEST_SCOPE = "oracle-compute-lab/payload+route-snapshot-v1" as const;
export const MAX_SOURCE_BYTES = 64 * 1024;
export const MAX_SOURCE_DEPTH = 64;

export type ComputeProfile = "risk-signal" | "proof-review" | "batch-transform";
export type SourceDisclosure = "digest-only" | "public-input";

export interface ComputeDraft {
  profile: ComputeProfile;
  disclosure: SourceDisclosure;
  source: string;
}

const COMPUTE_PROFILES = new Set<ComputeProfile>([
  "risk-signal",
  "proof-review",
  "batch-transform",
]);
const SOURCE_DISCLOSURES = new Set<SourceDisclosure>(["digest-only", "public-input"]);

export function isComputeProfile(value: unknown): value is ComputeProfile {
  return typeof value === "string" && COMPUTE_PROFILES.has(value as ComputeProfile);
}

export function isSourceDisclosure(value: unknown): value is SourceDisclosure {
  return typeof value === "string" && SOURCE_DISCLOSURES.has(value as SourceDisclosure);
}

export type SourceInspection =
  | {
      valid: true;
      byteLength: number;
      parsed: unknown;
      shape: string;
    }
  | {
      valid: false;
      byteLength: number;
      error: "source_required" | "source_too_large" | "source_too_deep" | "source_unsafe_number" | "invalid_json";
      shape: "invalid";
    };

export interface ComputeRouteSnapshot {
  network: NeoNetwork;
  runtimeBaseUrl: string;
  route: string;
  workflow: typeof COMPUTE_WORKFLOW_ID;
  envelopeVersion: string;
  policies: string[];
  teeRequired: boolean;
  deliveryMode: string;
  registryOracleContract: string;
}

export interface LocalComputeRequestPackage {
  kind: "oracle.compute.request";
  packageFormat: typeof LOCAL_PACKAGE_VERSION;
  requestDigestScope: typeof REQUEST_DIGEST_SCOPE;
  requestDigest: string;
  payload: {
    kind: "oracle.compute.request";
    appId: "miniapp-oracle-compute-lab";
    packageFormat: typeof LOCAL_PACKAGE_VERSION;
    workflow: typeof COMPUTE_WORKFLOW_ID;
    profile: ComputeProfile;
    sourcePolicy: SourceDisclosure;
    inputDigest: string;
    encryption: "none";
    dispatchReady: false;
    execution: "not_dispatched";
    input?: unknown;
  };
  routeSnapshot: ComputeRouteSnapshot;
  boundary: {
    jobId: null;
    compute: "not_executed";
    result: "unavailable";
    proof: "unavailable";
    attestation: "unavailable";
    pending: "not_applicable";
    retry: "not_applicable";
    readback: "not_applicable";
    reason: "authenticated_runtime_dispatch_not_implemented";
  };
}

function stableJson(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0);
    return `{${entries
      .map(([key, nested]) => `${JSON.stringify(key)}:${stableJson(nested)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function exceedsSourceDepth(value: unknown): boolean {
  const queue: Array<{ value: unknown; depth: number }> = [{ value, depth: 0 }];
  while (queue.length > 0) {
    const current = queue.pop();
    if (!current) break;
    if (current.depth > MAX_SOURCE_DEPTH) return true;
    if (Array.isArray(current.value)) {
      for (const item of current.value) {
        queue.push({ value: item, depth: current.depth + 1 });
      }
    } else if (current.value && typeof current.value === "object") {
      for (const item of Object.values(current.value as Record<string, unknown>)) {
        queue.push({ value: item, depth: current.depth + 1 });
      }
    }
  }
  return false;
}

function containsUnsafeNumber(value: unknown): boolean {
  const pending = [value];
  while (pending.length > 0) {
    const current = pending.pop();
    if (typeof current === "number") {
      if (!Number.isFinite(current)) return true;
      if (Number.isInteger(current) && !Number.isSafeInteger(current)) return true;
      continue;
    }
    if (Array.isArray(current)) {
      pending.push(...current);
    } else if (current && typeof current === "object") {
      pending.push(...Object.values(current as Record<string, unknown>));
    }
  }
  return false;
}

function sourceShape(value: unknown): string {
  if (Array.isArray(value)) return `array:${value.length}`;
  if (value && typeof value === "object") {
    const keys = Object.keys(value as Record<string, unknown>);
    return keys.length > 0 ? `object:${keys.slice(0, 4).join(",")}` : "object:empty";
  }
  return typeof value;
}

export function inspectComputeSource(source: string): SourceInspection {
  const text = String(source ?? "");
  const byteLength = new TextEncoder().encode(text).byteLength;
  if (!text.trim()) {
    return { valid: false, byteLength, error: "source_required", shape: "invalid" };
  }
  if (byteLength > MAX_SOURCE_BYTES) {
    return { valid: false, byteLength, error: "source_too_large", shape: "invalid" };
  }
  try {
    const parsed = JSON.parse(text) as unknown;
    if (exceedsSourceDepth(parsed)) {
      return { valid: false, byteLength, error: "source_too_deep", shape: "invalid" };
    }
    if (containsUnsafeNumber(parsed)) {
      return { valid: false, byteLength, error: "source_unsafe_number", shape: "invalid" };
    }
    return { valid: true, byteLength, parsed, shape: sourceShape(parsed) };
  } catch {
    return { valid: false, byteLength, error: "invalid_json", shape: "invalid" };
  }
}

export function resolveComputeRouteSnapshot(network: NeoNetwork = getNetwork()): ComputeRouteSnapshot {
  const integration = getExternalIntegrationConfig(network);
  const workflow = MORPHEUS_PUBLIC_RUNTIME_CATALOG.workflows.find(
    (candidate) => candidate.id === COMPUTE_WORKFLOW_ID,
  );
  if (!workflow) throw new Error(`Missing ${COMPUTE_WORKFLOW_ID} in the Morpheus runtime catalog`);
  if (!workflow.allowedNetworks.includes(network)) {
    throw new Error(`${COMPUTE_WORKFLOW_ID} is not registered for ${network}`);
  }

  return {
    network,
    runtimeBaseUrl: integration.morpheusRuntimeUrl,
    route: workflow.route,
    workflow: COMPUTE_WORKFLOW_ID,
    envelopeVersion: integration.morpheusEnvelopeVersion,
    policies: [...workflow.policies],
    teeRequired: workflow.execution.teeRequired,
    deliveryMode: workflow.delivery.mode,
    registryOracleContract: integration.contracts.morpheusOracle,
  };
}

export async function buildLocalComputeRequest(
  draft: ComputeDraft,
  network: NeoNetwork = getNetwork(),
): Promise<LocalComputeRequestPackage> {
  if (!isComputeProfile(draft.profile)) throw new Error("invalid_profile");
  if (!isSourceDisclosure(draft.disclosure)) throw new Error("invalid_disclosure");
  const inspected = inspectComputeSource(draft.source);
  if (!inspected.valid) throw new Error(inspected.error);
  if (!globalThis.crypto?.subtle) throw new Error("shaUnavailable");

  const routeSnapshot = resolveComputeRouteSnapshot(network);
  const normalizedSource = inspected.parsed;
  const inputDigest = `0x${await sha256Hex(stableJson(normalizedSource))}`;
  const unsignedPayload = {
    kind: "oracle.compute.request" as const,
    appId: "miniapp-oracle-compute-lab" as const,
    packageFormat: LOCAL_PACKAGE_VERSION,
    workflow: COMPUTE_WORKFLOW_ID,
    profile: draft.profile,
    sourcePolicy: draft.disclosure,
    inputDigest,
    // Digest-only means omission from this local review package. It is not
    // cryptographic sealing, so the package records the boundary explicitly.
    encryption: "none" as const,
    dispatchReady: false as const,
    execution: "not_dispatched" as const,
    ...(draft.disclosure === "public-input" ? { input: normalizedSource } : {}),
  };
  const requestDigest = `0x${await sha256Hex(stableJson({
    scope: REQUEST_DIGEST_SCOPE,
    payload: unsignedPayload,
    routeSnapshot,
  }))}`;

  return {
    kind: "oracle.compute.request",
    packageFormat: LOCAL_PACKAGE_VERSION,
    requestDigestScope: REQUEST_DIGEST_SCOPE,
    requestDigest,
    // The digest covers this exact returned payload plus the route snapshot.
    // Keep the digest only at the package level to avoid a self-referential
    // field that could not itself be part of the hash preimage.
    payload: unsignedPayload,
    routeSnapshot,
    boundary: {
      jobId: null,
      compute: "not_executed",
      result: "unavailable",
      proof: "unavailable",
      attestation: "unavailable",
      pending: "not_applicable",
      retry: "not_applicable",
      readback: "not_applicable",
      reason: "authenticated_runtime_dispatch_not_implemented",
    },
  };
}
