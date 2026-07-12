import type { MiniAppFramework } from "@shared/react";
import {
  getExternalIntegrationConfig,
  getNetwork,
  resolveNeoNetwork,
  type NeoNetwork,
} from "@shared/constants/rpc";
import { addressToScriptHash, parseHash160 } from "@shared/utils/neo";
import { fetchWithTimeout } from "@shared/utils/fetch-timeout";
import {
  decodeSessionKey,
  formatGasBaseUnits,
  type DecodedSessionKey,
} from "./utils/sessionKeyDecode";

export const CANONICAL_SESSION_KEY_CONTRACTS = {
  mainnet: {
    aaCore: "0x0268a387913b250166ddec032b03332690a1ef78",
    verifier: "0x3ba8333406e59f9fd83cf378b33706a33d9f3755",
    setSessionKeyArity: 7,
    allowanceSupported: true,
  },
  testnet: {
    aaCore: "0xdbf38e7b2117186bf7a5e17ead702322c0c5b6f2",
    verifier: "0xed44c88535650b4dd6b8d59776e6ed045462cab6",
    setSessionKeyArity: 5,
    allowanceSupported: false,
  },
} as const;

export type SessionAccountReadStatus = "idle" | "loading" | "ready" | "missing" | "unavailable";
export type SessionRecordStatus = "idle" | "active" | "expired" | "absent" | "unavailable";

export interface SessionKeyContext {
  network: NeoNetwork;
  aaCore: string;
  verifier: string;
  allowanceSupported: boolean;
  setSessionKeyArity: 5 | 7;
}

export interface SessionRecordRead {
  status: Exclude<SessionRecordStatus, "idle">;
  raw: unknown;
  decoded: DecodedSessionKey | null;
  spentGas: string;
}

export interface SessionAccountSnapshot {
  status: Exclude<SessionAccountReadStatus, "idle" | "loading">;
  accountIdHash: string;
  owner: string;
  verifier: string;
  verifierBound: boolean;
  canonicalCoreBound: boolean;
  session: SessionRecordRead;
  checkedAt: string;
}

export type SessionTransactionState = "halt" | "fault" | "unknown";

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

export function explicitNeoNetwork(value: unknown): NeoNetwork | "" {
  const normalized = clean(value).toLowerCase();
  if (normalized === "mainnet" || normalized === "neo-n3-mainnet") return "mainnet";
  if (normalized === "testnet" || normalized === "neo-n3-testnet") return "testnet";
  return "";
}

function reverseHash(value: string): string {
  const bytes = value.replace(/^0x/i, "").match(/../g) ?? [];
  return bytes.length === 20 ? `0x${[...bytes].reverse().join("")}`.toLowerCase() : "";
}

export function normalizeSessionAccount(value: unknown, allowZero = false): string {
  const raw = clean(value);
  if (!raw) return "";
  if (/^N[A-Za-z0-9]{33}$/.test(raw)) {
    try {
      const hash = addressToScriptHash(raw).toLowerCase();
      return allowZero || !/^0x0{40}$/.test(hash) ? hash : "";
    } catch {
      return "";
    }
  }
  if (/^0x[0-9a-fA-F]{40}$/.test(raw)) {
    const hash = raw.toLowerCase();
    return allowZero || !/^0x0{40}$/.test(hash) ? hash : "";
  }
  const parsed = parseHash160(value).toLowerCase();
  if (/^0x[0-9a-f]{40}$/.test(parsed)) {
    return allowZero || !/^0x0{40}$/.test(parsed) ? parsed : "";
  }
  return "";
}

function normalizeSessionChainAccount(value: unknown, allowZero = false): string {
  const parsed = parseHash160(value).toLowerCase();
  if (/^0x[0-9a-f]{40}$/.test(parsed)) {
    return allowZero || !/^0x0{40}$/.test(parsed) ? parsed : "";
  }
  return normalizeSessionAccount(value, allowZero);
}

export function sessionAccountsMatch(left: unknown, right: unknown): boolean {
  const variants = (value: unknown) => {
    const result = new Set<string>();
    const normalized = normalizeSessionAccount(value, true);
    if (normalized) {
      result.add(normalized);
      result.add(reverseHash(normalized));
    }
    return result;
  };
  const a = variants(left);
  const b = variants(right);
  return a.size > 0 && b.size > 0 && [...a].some((value) => b.has(value));
}

export async function readSessionTransactionState(
  network: NeoNetwork,
  transactionId: string,
): Promise<SessionTransactionState> {
  const txid = clean(transactionId).toLowerCase();
  if (!/^0x[0-9a-f]{64}$/.test(txid)) return "unknown";
  try {
    const response = await fetchWithTimeout(getExternalIntegrationConfig(network).rpcUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getapplicationlog",
        params: [txid],
      }),
      timeoutMs: 8_000,
    });
    if (!response.ok) return "unknown";
    const payload = await response.json() as {
      error?: unknown;
      result?: { executions?: Array<{ vmstate?: unknown }> };
    };
    if (payload.error) return "unknown";
    const states = (payload.result?.executions ?? [])
      .map((execution) => clean(execution.vmstate).toUpperCase())
      .filter(Boolean);
    if (states.some((state) => state.includes("FAULT"))) return "fault";
    if (states.length && states.every((state) => state.includes("HALT"))) return "halt";
    return "unknown";
  } catch {
    return "unknown";
  }
}

function targetNetwork(app: MiniAppFramework): NeoNetwork {
  return explicitNeoNetwork(app.platform.launch.network) || resolveNeoNetwork(getNetwork());
}

function pinnedContext(network: NeoNetwork): SessionKeyContext {
  const pinned = CANONICAL_SESSION_KEY_CONTRACTS[network];
  const registry = getExternalIntegrationConfig(network).contracts;
  if (
    clean(registry.aaCore).toLowerCase() !== pinned.aaCore ||
    clean(registry.aaSessionKeyVerifier).toLowerCase() !== pinned.verifier
  ) {
    throw new Error("sessionCanonicalContextMismatch");
  }
  return {
    network,
    aaCore: pinned.aaCore,
    verifier: pinned.verifier,
    allowanceSupported: pinned.allowanceSupported,
    setSessionKeyArity: pinned.setSessionKeyArity,
  };
}

export async function resolveSessionReadContext(
  app: MiniAppFramework,
): Promise<{ context: SessionKeyContext; detectedNetwork: NeoNetwork | "" }> {
  const expected = targetNetwork(app);
  let detectedNetwork: NeoNetwork | "" = "";
  try {
    detectedNetwork = explicitNeoNetwork(await app.chain.detectNetwork());
  } catch {
    // Read-only inspection remains available from the explicit launch URL.
  }
  if (detectedNetwork && detectedNetwork !== expected) {
    throw new Error("sessionWalletNetworkMismatch");
  }
  const context = pinnedContext(expected);
  const configured = normalizeSessionAccount(app.chain.contractAddress?.get?.(), true);
  if (configured && !sessionAccountsMatch(configured, context.verifier)) {
    throw new Error("sessionCanonicalContextMismatch");
  }
  return { context, detectedNetwork };
}

export async function requireSessionWriteContext(app: MiniAppFramework): Promise<SessionKeyContext> {
  const expected = targetNetwork(app);
  const detected = explicitNeoNetwork(await app.chain.detectNetwork());
  if (!detected) throw new Error("sessionWalletNetworkUnverified");
  if (detected !== expected) throw new Error("sessionWalletNetworkMismatch");
  const context = pinnedContext(expected);
  const configured = normalizeSessionAccount(app.chain.contractAddress?.get?.(), true);
  if (configured && !sessionAccountsMatch(configured, context.verifier)) {
    throw new Error("sessionCanonicalContextMismatch");
  }
  return context;
}

function emptySession(raw: unknown): boolean {
  if (raw === null || raw === undefined || raw === "") return true;
  if (Array.isArray(raw) && raw.length === 0) return true;
  if (raw && typeof raw === "object" && (raw as { type?: unknown }).type === "Any") return true;
  return false;
}

export async function readSessionRecord(
  app: MiniAppFramework,
  context: SessionKeyContext,
  accountIdHash: string,
): Promise<SessionRecordRead> {
  let raw: unknown;
  try {
    raw = await app.chain.readRaw(
      "getSessionKey",
      [app.chain.arg.hash160(accountIdHash)],
      { scriptHash: context.verifier },
    );
  } catch {
    return { status: "unavailable", raw: null, decoded: null, spentGas: "" };
  }
  if (emptySession(raw)) {
    return { status: "absent", raw, decoded: null, spentGas: "" };
  }
  const decoded = decodeSessionKey(raw, {
    spendingLimitSupported: context.allowanceSupported,
  });
  if (!decoded) {
    return { status: "unavailable", raw, decoded: null, spentGas: "" };
  }
  let spentGas = "";
  if (context.allowanceSupported) {
    try {
      const spent = await app.chain.readRaw(
        "getSpentAmount",
        [app.chain.arg.hash160(accountIdHash)],
        { scriptHash: context.verifier },
      );
      const normalized = clean(spent);
      if (!/^-?\d+$/.test(normalized)) {
        return { status: "unavailable", raw, decoded: null, spentGas: "" };
      }
      spentGas = formatGasBaseUnits(normalized);
    } catch {
      return { status: "unavailable", raw, decoded: null, spentGas: "" };
    }
  }
  return {
    status: decoded.expirySeconds <= Math.floor(Date.now() / 1000) ? "expired" : "active",
    raw,
    decoded,
    spentGas,
  };
}

export async function readSessionAccount(
  app: MiniAppFramework,
  context: SessionKeyContext,
  accountIdHash: string,
): Promise<SessionAccountSnapshot> {
  try {
    const [ownerRaw, verifierRaw] = await Promise.all([
      app.chain.readRaw(
        "getBackupOwner",
        [app.chain.arg.hash160(accountIdHash)],
        { scriptHash: context.aaCore },
      ),
      app.chain.readRaw(
        "getVerifier",
        [app.chain.arg.hash160(accountIdHash)],
        { scriptHash: context.aaCore },
      ),
    ]);
    const noOwner = ownerRaw === null || ownerRaw === undefined || ownerRaw === "";
    const noVerifier = verifierRaw === null || verifierRaw === undefined || verifierRaw === "";
    if (noOwner && noVerifier) {
      return {
        status: "missing",
        accountIdHash,
        owner: "",
        verifier: "",
        verifierBound: false,
        canonicalCoreBound: false,
        session: { status: "absent", raw: null, decoded: null, spentGas: "" },
        checkedAt: new Date().toISOString(),
      };
    }
    const owner = normalizeSessionChainAccount(ownerRaw);
    const verifier = normalizeSessionChainAccount(verifierRaw);
    if (!owner || !verifier) throw new Error("sessionAccountReadMalformed");

    let canonicalCoreBound = true;
    if (context.network === "mainnet") {
      const authorizedCoreRaw = await app.chain.readRaw(
        "authorizedCore",
        [],
        { scriptHash: context.verifier },
      );
      canonicalCoreBound = sessionAccountsMatch(authorizedCoreRaw, context.aaCore);
    }
    if (!canonicalCoreBound) throw new Error("sessionCanonicalContextMismatch");

    const session = await readSessionRecord(app, context, accountIdHash);
    return {
      status: session.status === "unavailable" ? "unavailable" : "ready",
      accountIdHash,
      owner,
      verifier,
      verifierBound: sessionAccountsMatch(verifier, context.verifier),
      canonicalCoreBound,
      session,
      checkedAt: new Date().toISOString(),
    };
  } catch {
    return {
      status: "unavailable",
      accountIdHash,
      owner: "",
      verifier: "",
      verifierBound: false,
      canonicalCoreBound: false,
      session: { status: "unavailable", raw: null, decoded: null, spentGas: "" },
      checkedAt: new Date().toISOString(),
    };
  }
}

export function matchesConfiguredSession(
  record: SessionRecordRead,
  expected: {
    publicKey: string;
    targetContract: string;
    allowedMethod: string;
    expiresAt: number;
    spendingLimitRaw: string;
  },
  allowanceSupported: boolean,
): boolean {
  const decoded = record.decoded;
  if (!decoded || (record.status !== "active" && record.status !== "expired")) return false;
  if (
    decoded.pubKey.toLowerCase() !== expected.publicKey.toLowerCase() ||
    !sessionAccountsMatch(decoded.targetContract, expected.targetContract) ||
    decoded.method !== expected.allowedMethod ||
    decoded.expirySeconds !== expected.expiresAt
  ) return false;
  if (!allowanceSupported) return true;
  return decoded.spendingLimitGas === formatGasBaseUnits(expected.spendingLimitRaw);
}
