import { createHash, ECDH } from "node:crypto";
import type { NextApiRequest } from "next";
import { getExternalIntegrationConfig, resolveNeoNetwork, type NeoNetwork } from "../../../apps/shared/constants/rpc";
import {
  resolveMorpheusRuntimeCandidates,
  resolveMorpheusRuntimeToken,
} from "./morpheus-endpoints";

const DID_DOCUMENT_CONTENT_TYPE = "application/did+ld+json";
const DID_RESOLUTION_CONTENT_TYPE = 'application/ld+json;profile="https://w3id.org/did-resolution"';
const MORPHEUS_DID_METHOD = "morpheus";
const MORPHEUS_NEODID_NETWORK = "neo_n3";
const MORPHEUS_NEODID_SERVICE = "neodid";
const MORPHEUS_NEODID_DID_CONTEXT = [
  "https://www.w3.org/ns/did/v1",
  "https://w3id.org/security/suites/jws-2020/v1",
];
const DEFAULT_NEODID_SERVICE_DID = `did:${MORPHEUS_DID_METHOD}:${MORPHEUS_NEODID_NETWORK}:service:${MORPHEUS_NEODID_SERVICE}`;

type DidKind = "service" | "vault" | "aa";

type ParsedMorpheusDid = {
  did: string;
  kind: DidKind;
  network: string;
  subject: string;
};

type NeoDidRuntimeSnapshot = {
  app_id?: string | null;
  compose_hash?: string | null;
  verification_public_key?: string | null;
  verifier_curve?: string | null;
  web3auth?: {
    jwks_url?: string | null;
    audience_configured?: boolean;
    derives_provider_uid_in_tee?: boolean;
  } | null;
};

export type ResolveDidResult = {
  body: Record<string, unknown>;
  contentType: string;
  status: number;
};

function resolveOrigin(req: NextApiRequest) {
  const proto = String(req.headers["x-forwarded-proto"] || "").trim() || (process.env.NODE_ENV === "production" ? "https" : "http");
  const host = String(req.headers["x-forwarded-host"] || req.headers.host || "").trim();
  if (!host) {
    return "http://localhost:3000";
  }
  return `${proto}://${host}`;
}

function base64Url(buffer: Buffer) {
  return buffer.toString("base64url");
}

function parseNetwork(value: unknown): NeoNetwork {
  return resolveNeoNetwork(String(value ?? "").trim().toLowerCase() === "testnet" ? "testnet" : "mainnet");
}

function isRetryableStatus(status: number) {
  return status === 408 || status === 409 || status === 425 || status === 429 || status >= 500;
}

function shouldFailOpen(status: number, text: string, contentType: string) {
  const normalizedText = text.toLowerCase();
  const normalizedType = contentType.toLowerCase();
  if (status === 429 && normalizedText.includes("error code: 1027")) return true;
  if (status === 429 && normalizedText.includes("temporarily rate limited")) return true;
  if (status >= 500 && normalizedType.includes("text/html") && normalizedText.includes("cloudflare"))
    return true;
  return false;
}

function resolveRuntimeProxyConfig(network: NeoNetwork) {
  return {
    runtimeUrls: resolveMorpheusRuntimeCandidates(network),
    runtimeToken: resolveMorpheusRuntimeToken(network),
  };
}

async function fetchRuntimeJson(path: string, network: NeoNetwork): Promise<Record<string, unknown> | null> {
  const { runtimeUrls, runtimeToken } = resolveRuntimeProxyConfig(network);
  if (runtimeUrls.length === 0) return null;

  const headers = new Headers({ accept: "application/json" });
  if (runtimeToken) {
    headers.set("authorization", `Bearer ${runtimeToken}`);
    headers.set("x-phala-token", runtimeToken);
  }

  let lastNonRetryableText = "";
  for (const runtimeUrl of runtimeUrls) {
    try {
      const response = await fetch(`${runtimeUrl}${path}`, {
        method: "GET",
        headers,
        cache: "no-store",
      });
      const text = await response.text();
      const contentType = response.headers.get("content-type") || "application/json";

      if (response.ok) {
        return text ? JSON.parse(text) as Record<string, unknown> : {};
      }

      if (!isRetryableStatus(response.status) && !shouldFailOpen(response.status, text, contentType)) {
        lastNonRetryableText = text;
        break;
      }
    } catch {
      // fall through to next candidate
    }
  }

  if (lastNonRetryableText) {
    return null;
  }
  return null;
}

async function fetchNeoDidRuntimeSnapshot(network: NeoNetwork): Promise<NeoDidRuntimeSnapshot | null> {
  const payload = await fetchRuntimeJson("/neodid/runtime", network);
  return payload as NeoDidRuntimeSnapshot | null;
}

export async function fetchNeoDidProviders(network: NeoNetwork): Promise<Record<string, unknown>> {
  const config = getExternalIntegrationConfig(network);
  const runtimeProviders = await fetchRuntimeJson("/neodid/providers", network);
  if (runtimeProviders) {
    return runtimeProviders;
  }

  return {
    network,
    source: "static-fallback",
    warning: "Dynamic NeoDID provider catalog is unavailable from the configured runtime; returning canonical network metadata only.",
    providers: [],
    registry: {
      contract: config.contracts.morpheusNeoDid || "",
      domain: config.domains.neodid || "",
    },
    oracle: {
      contract: config.contracts.morpheusOracle,
      domain: config.domains.oracle || "",
    },
    aa: {
      contract: config.contracts.aaCore,
      domain: config.domains.aa || "",
    },
    runtime: {
      public_api_url: config.morpheusPublicApiUrl,
      runtime_url: config.morpheusRuntimeUrl,
      runtime_urls: config.morpheusRuntimeUrls,
      edge_url: config.morpheusEdgeUrl,
      control_plane_url: config.morpheusControlPlaneUrl,
    },
  };
}

function decodeDidSegment(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function parseMorpheusDid(rawDid: string): ParsedMorpheusDid | null {
  const trimmed = String(rawDid || "").trim();
  if (!trimmed) return null;

  const parts = trimmed.split(":");
  if (parts.length < 5 || parts[0] !== "did" || parts[1] !== MORPHEUS_DID_METHOD) {
    return null;
  }

  const network = String(parts[2] || "").toLowerCase();
  const kind = String(parts[3] || "").toLowerCase() as DidKind;
  const subject = decodeDidSegment(parts.slice(4).join(":"));

  if (network !== MORPHEUS_NEODID_NETWORK) return null;
  if (!["service", "vault", "aa"].includes(kind)) return null;

  if (kind === "service") {
    const normalizedService = subject.toLowerCase();
    if (normalizedService !== MORPHEUS_NEODID_SERVICE) return null;
    return {
      did: DEFAULT_NEODID_SERVICE_DID,
      kind,
      network,
      subject: normalizedService,
    };
  }

  if (kind === "vault") {
    const normalizedHash = subject.replace(/^0x/i, "").toLowerCase();
    if (!/^[0-9a-f]{40}$/.test(normalizedHash)) return null;
    return {
      did: `did:${MORPHEUS_DID_METHOD}:${network}:vault:${normalizedHash}`,
      kind,
      network,
      subject: normalizedHash,
    };
  }

  const normalizedAccountId = subject.trim();
  if (!normalizedAccountId || Buffer.byteLength(normalizedAccountId, "utf8") > 160) return null;
  return {
    did: `did:${MORPHEUS_DID_METHOD}:${network}:aa:${encodeURIComponent(normalizedAccountId)}`,
    kind,
    network,
    subject: normalizedAccountId,
  };
}

function compressedP256ToJwk(compressedHex: string) {
  const normalized = String(compressedHex || "").replace(/^0x/i, "").trim();
  if (!/^(02|03)[0-9a-fA-F]{64}$/.test(normalized)) return null;

  const compressed = Buffer.from(normalized, "hex");
  const converted = ECDH.convertKey(compressed, "prime256v1", undefined, undefined, "uncompressed");
  const uncompressed = Buffer.isBuffer(converted) ? converted : Buffer.from(converted, "binary");
  const x = uncompressed.subarray(1, 33);
  const y = uncompressed.subarray(33, 65);

  return {
    kty: "EC",
    crv: "P-256",
    x: base64Url(x),
    y: base64Url(y),
    kid: base64Url(createHash("sha256").update(compressed).digest()),
  };
}

function buildCommonDocumentMetadata(parsed: ParsedMorpheusDid, runtime: NeoDidRuntimeSnapshot | null, network: NeoNetwork) {
  const config = getExternalIntegrationConfig(network);
  return {
    canonicalId: parsed.did,
    deactivated: false,
    versionId: runtime?.compose_hash || "unversioned",
    updated: new Date().toISOString(),
    network: parsed.network,
    anchorContract: config.contracts.morpheusNeoDid || "",
  };
}

function buildServiceDidDocument(parsed: ParsedMorpheusDid, runtime: NeoDidRuntimeSnapshot | null, origin: string, network: NeoNetwork) {
  const config = getExternalIntegrationConfig(network);
  const did = parsed.did;
  const verificationJwk = compressedP256ToJwk(runtime?.verification_public_key || "");
  const verificationMethodId = `${did}#tee-verifier`;
  const verificationMethod = verificationJwk
    ? [{
        id: verificationMethodId,
        type: "JsonWebKey2020",
        controller: did,
        publicKeyJwk: verificationJwk,
      }]
    : [];
  const verificationReferences = verificationMethod.length > 0 ? [verificationMethodId] : [];

  return {
    "@context": [...MORPHEUS_NEODID_DID_CONTEXT],
    id: did,
    controller: [did],
    verificationMethod,
    authentication: verificationReferences,
    assertionMethod: verificationReferences,
    service: [
      {
        id: `${did}#resolver`,
        type: "DIDResolutionService",
        serviceEndpoint: `${origin}/api/morpheus/neodid/resolve?did=${encodeURIComponent(did)}&network=${network}`,
      },
      {
        id: `${did}#registry`,
        type: "MorpheusNeoDIDRegistry",
        serviceEndpoint: {
          network: parsed.network,
          contract: config.contracts.morpheusNeoDid || "",
          nns: config.domains.neodid || "",
          read_methods: [
            "getBinding",
            "isMasterNullifierUsed",
            "isActionNullifierUsed",
          ],
          write_methods: [
            "registerBinding",
            "revokeBinding",
            "useActionTicket",
          ],
        },
      },
      {
        id: `${did}#oracle-entry`,
        type: "MorpheusOracleGateway",
        serviceEndpoint: {
          network: parsed.network,
          contract: config.contracts.morpheusOracle,
          nns: config.domains.oracle || "",
          request_types: [
            "neodid_bind",
            "neodid_action_ticket",
            "neodid_recovery_ticket",
          ],
          fee_model: "0.01 GAS prepaid credit per request",
        },
      },
      {
        id: `${did}#runtime`,
        type: "MorpheusNeoDIDRuntime",
        serviceEndpoint: {
          runtime_url: config.morpheusRuntimeUrl,
          viewer_url: `${config.morpheusPublicApiUrl}/launchpad/neodid-resolver?did=${encodeURIComponent(did)}`,
          documentation_url: `${config.morpheusPublicApiUrl}/docs/neodid`,
          app_id: runtime?.app_id || null,
          compose_hash: runtime?.compose_hash || null,
          verification_public_key: runtime?.verification_public_key || null,
          verifier_curve: runtime?.verifier_curve || "secp256r1",
          web3auth: runtime?.web3auth || null,
        },
      },
    ],
  };
}

function buildSubjectDidDocument(parsed: ParsedMorpheusDid, origin: string, network: NeoNetwork) {
  const config = getExternalIntegrationConfig(network);
  const did = parsed.did;
  const subjectDescriptor = parsed.kind === "vault"
    ? { vault_hash160: `0x${parsed.subject}` }
    : { account_id: parsed.subject };

  return {
    "@context": [...MORPHEUS_NEODID_DID_CONTEXT],
    id: did,
    controller: [DEFAULT_NEODID_SERVICE_DID],
    service: [
      {
        id: `${did}#resolver`,
        type: "DIDResolutionService",
        serviceEndpoint: `${origin}/api/morpheus/neodid/resolve?did=${encodeURIComponent(did)}&network=${network}`,
      },
      {
        id: `${did}#binding-model`,
        type: "MorpheusNeoDIDSubject",
        serviceEndpoint: {
          network: parsed.network,
          subject_kind: parsed.kind,
          ...subjectDescriptor,
          privacy_model: "public DID document only exposes namespace metadata and service endpoints; private claims stay encrypted or off-chain",
          registry_contract: config.contracts.morpheusNeoDid || "",
          registry_nns: config.domains.neodid || "",
          oracle_contract: config.contracts.morpheusOracle,
          oracle_nns: config.domains.oracle || "",
          resolution_hint: "Use neodid_bind, neodid_action_ticket, or neodid_recovery_ticket through Morpheus Oracle; raw identity claims are not part of DID resolution output.",
        },
      },
      {
        id: `${did}#recovery`,
        type: "MorpheusAARecovery",
        serviceEndpoint: {
          aa_contract: config.contracts.aaCore,
          aa_nns: config.domains.aa || "",
          public_api_url: config.morpheusPublicApiUrl,
        },
      },
    ],
  };
}

function prefersDidDocument(accept: string | null | undefined, format: string | null | undefined) {
  const normalizedFormat = String(format || "").trim().toLowerCase();
  if (normalizedFormat === "document") return true;
  return String(accept || "").toLowerCase().includes(DID_DOCUMENT_CONTENT_TYPE);
}

export async function resolveMorpheusDid(
  did: string,
  options: { accept?: string | null; format?: string | null; req: NextApiRequest; network?: string | null | undefined },
): Promise<ResolveDidResult> {
  const parsed = parseMorpheusDid(did);
  if (!parsed) {
    return {
      status: 400,
      contentType: DID_RESOLUTION_CONTENT_TYPE,
      body: {
        didResolutionMetadata: {
          error: "invalidDid",
          message: "Expected did:morpheus:neo_n3:service:neodid, did:morpheus:neo_n3:vault:<hash160>, or did:morpheus:neo_n3:aa:<account-id>.",
          contentType: DID_RESOLUTION_CONTENT_TYPE,
        },
        didDocument: null,
        didDocumentMetadata: {},
      },
    };
  }

  const network = parseNetwork(options.network);
  const runtime = await fetchNeoDidRuntimeSnapshot(network);
  const origin = resolveOrigin(options.req);
  const wantsDocument = prefersDidDocument(options.accept, options.format);
  const contentType = wantsDocument ? DID_DOCUMENT_CONTENT_TYPE : DID_RESOLUTION_CONTENT_TYPE;
  const didDocument = parsed.kind === "service"
    ? buildServiceDidDocument(parsed, runtime, origin, network)
    : buildSubjectDidDocument(parsed, origin, network);

  if (wantsDocument) {
    return {
      status: 200,
      contentType,
      body: didDocument,
    };
  }

  return {
    status: 200,
    contentType,
    body: {
      didResolutionMetadata: {
        contentType,
      },
      didDocument,
      didDocumentMetadata: buildCommonDocumentMetadata(parsed, runtime, network),
    },
  };
}
