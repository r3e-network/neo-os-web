import { MORPHEUS_ENCRYPTION_ALGORITHM } from "@framework/oracle-ext";
import {
  EXTERNAL_INTEGRATIONS,
  type NeoNetwork,
} from "@shared/constants/rpc";

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

interface JsonRecord {
  [key: string]: unknown;
}

export interface OracleSealContractEvidence {
  network: NeoNetwork;
  rpcUrl: string;
  contract: string;
  contractName: "MorpheusOracle";
  publicKey: string;
  algorithm: typeof MORPHEUS_ENCRYPTION_ALGORITHM;
  checkedAt: number;
}

export interface OracleSealStoreCapability {
  network: NeoNetwork;
  targetChain: "neo_n3";
  checkedAt: number;
}

function asRecord(value: unknown): JsonRecord | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as JsonRecord
    : null;
}

function decodeBase64(value: string): Uint8Array | null {
  if (!value || !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) return null;
  try {
    const decoded = globalThis.atob(value);
    return Uint8Array.from(decoded, (character) => character.charCodeAt(0));
  } catch {
    return null;
  }
}

function decodeStackText(value: unknown): string {
  const item = asRecord(value);
  const type = String(item?.type ?? "");
  const raw = String(item?.value ?? "");
  if (type === "String") return raw;
  if (type !== "ByteString") throw new Error("Oracle contract returned an unexpected stack type");
  const bytes = decodeBase64(raw);
  if (!bytes) throw new Error("Oracle contract returned malformed base64 text");
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new Error("Oracle contract returned non-text evidence");
  }
}

function resultFor(responses: Map<string, JsonRecord>, id: string): JsonRecord {
  const response = responses.get(id);
  if (!response || response.error) throw new Error(`Oracle contract ${id} read failed`);
  const result = asRecord(response.result);
  if (!result || String(result.state ?? "").toUpperCase() !== "HALT") {
    throw new Error(`Oracle contract ${id} read did not halt successfully`);
  }
  return result;
}

function stackText(responses: Map<string, JsonRecord>, id: string): string {
  const result = resultFor(responses, id);
  const stack = Array.isArray(result.stack) ? result.stack : [];
  if (stack.length !== 1) throw new Error(`Oracle contract ${id} response is malformed`);
  const text = decodeStackText(stack[0]).trim();
  if (!text || /[\u0000-\u001f\u007f]/.test(text)) {
    throw new Error(`Oracle contract ${id} response is empty or malformed`);
  }
  return text;
}

function contractName(responses: Map<string, JsonRecord>): string {
  const response = responses.get("contract");
  if (!response || response.error) throw new Error("Oracle contract state read failed");
  const result = asRecord(response.result);
  const manifest = asRecord(result?.manifest);
  return String(manifest?.name ?? "").trim();
}

/** Verify that the same-origin host has a configured server-to-server store lane. */
export async function readOracleSealStoreCapability(
  network: NeoNetwork,
  options: {
    fetcher?: FetchLike;
    timeoutMs?: number;
    now?: () => number;
  } = {},
): Promise<OracleSealStoreCapability> {
  const fetcher = options.fetcher ?? globalThis.fetch.bind(globalThis);
  const timeoutMs = Math.max(1_000, Math.min(30_000, Math.trunc(options.timeoutMs ?? 8_000)));
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetcher(
      `/api/morpheus/confidential/store?network=${encodeURIComponent(network)}`,
      {
        method: "GET",
        headers: { accept: "application/json" },
        cache: "no-store",
        signal: controller.signal,
      },
    );
    if (!response.ok) throw new Error(`Confidential store capability returned HTTP ${response.status}`);
    const payload = asRecord(await response.json());
    if (
      payload?.available !== true
      || payload.network !== network
      || payload.target_chain !== "neo_n3"
    ) {
      throw new Error("Confidential store capability is not configured for this network");
    }
    const checkedAt = (options.now ?? Date.now)();
    if (!Number.isSafeInteger(checkedAt) || checkedAt <= 0) {
      throw new Error("Confidential store capability has an invalid timestamp");
    }
    return { network, targetChain: "neo_n3", checkedAt };
  } catch (error) {
    if (controller.signal.aborted) throw new Error("Confidential store capability timed out");
    throw error;
  } finally {
    globalThis.clearTimeout(timeout);
  }
}

/**
 * Read the selected Neo N3 RPC directly, without requiring a wallet provider.
 * The endpoint key and this independent contract evidence must agree before a
 * new ciphertext can be prepared.
 */
export async function readOracleSealContractEvidence(
  network: NeoNetwork,
  options: {
    fetcher?: FetchLike;
    timeoutMs?: number;
    now?: () => number;
  } = {},
): Promise<OracleSealContractEvidence> {
  const environment = EXTERNAL_INTEGRATIONS[network];
  const rpcUrl = environment.rpcUrl;
  const contract = environment.contracts.morpheusOracle.toLowerCase();
  const fetcher = options.fetcher ?? globalThis.fetch.bind(globalThis);
  const timeoutMs = Math.max(1_000, Math.min(30_000, Math.trunc(options.timeoutMs ?? 8_000)));
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), timeoutMs);
  const payload = [
    {
      jsonrpc: "2.0",
      id: "contract",
      method: "getcontractstate",
      params: [contract],
    },
    ...[
      ["key", "oracleEncryptionPublicKey"],
      ["algorithm", "oracleEncryptionAlgorithm"],
    ].map(([id, operation]) => ({
      jsonrpc: "2.0",
      id,
      method: "invokefunction",
      params: [contract, operation, []],
    })),
  ];

  try {
    const response = await fetcher(rpcUrl, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Oracle contract RPC returned HTTP ${response.status}`);
    const raw: unknown = await response.json();
    if (!Array.isArray(raw)) throw new Error("Oracle contract RPC batch response is missing");
    const responses = new Map<string, JsonRecord>();
    for (const item of raw) {
      const record = asRecord(item);
      if (record) responses.set(String(record.id ?? ""), record);
    }

    const name = contractName(responses);
    if (name !== "MorpheusOracle") throw new Error("Selected contract is not MorpheusOracle");
    const publicKey = stackText(responses, "key");
    if (decodeBase64(publicKey)?.byteLength !== 32) {
      throw new Error("Oracle contract X25519 key is not 32 bytes");
    }
    const algorithm = stackText(responses, "algorithm");
    if (algorithm !== MORPHEUS_ENCRYPTION_ALGORITHM) {
      throw new Error("Oracle contract encryption algorithm is unsupported");
    }
    const checkedAt = (options.now ?? Date.now)();
    if (!Number.isSafeInteger(checkedAt) || checkedAt <= 0) {
      throw new Error("Oracle contract evidence has an invalid timestamp");
    }
    return {
      network,
      rpcUrl,
      contract,
      contractName: name,
      publicKey,
      algorithm,
      checkedAt,
    };
  } catch (error) {
    if (controller.signal.aborted) throw new Error("Oracle contract RPC timed out");
    throw error;
  } finally {
    globalThis.clearTimeout(timeout);
  }
}
