/**
 * On-chain Morpheus DataFeed reader.
 *
 * Reads asset prices DIRECTLY from the deployed MorpheusDataFeed contract
 * via Neo N3 JSON-RPC `invokefunction`. No HTTP, no Phala dependency, no
 * edge proxy — the miniapp platform stays self-contained and price data
 * comes from the same source-of-truth that any on-chain consumer would
 * read.
 *
 * Trade-off vs HTTP:
 *   - on-chain read is one RPC call (~300ms), no GAS cost (read-only)
 *   - data freshness depends on how often the Phala TEE pushes updates
 *     to the contract (currently every few hours in normal operation)
 *   - no per-call TEE attestation in the response — but the on-chain
 *     value is signed by the registered oracleVerificationPublicKey when
 *     it's written, so the trust path is the same.
 */
import { createObservable } from "@shared/react/context";
import type { Observable } from "@shared/react/context";
import { EXTERNAL_INTEGRATIONS, type NeoNetwork, getNetwork } from "../constants/rpc";

export interface UseMorpheusDataFeedConfig {
  network?: NeoNetwork;
  rpcUrl?: string;
}

export interface MorpheusDataFeedHandle {
  network: NeoNetwork;
  error: Observable<string | null>;
  getPrice: (asset: string) => Promise<number>;
  listPairs: () => Promise<string[]>;
}

interface NeoStackItem {
  type: string;
  value?: unknown;
}

interface InvokeResult {
  state?: string;
  exception?: string | null;
  stack?: NeoStackItem[];
}

interface RpcResponse<T> {
  jsonrpc?: string;
  id?: number;
  result?: T;
  error?: { message?: string; code?: number };
}

function normalizeAsset(asset: string): string {
  const v = String(asset || "").trim().toUpperCase();
  if (!v) throw new Error("asset is required");
  if (v.startsWith("TWELVEDATA:")) return v;
  if (v.includes("/")) return `TWELVEDATA:${v.replace("/", "-")}`;
  if (v.includes("-")) return `TWELVEDATA:${v}`;
  return `TWELVEDATA:${v}-USD`;
}

function decodeBase64String(b64: string): string {
  if (typeof globalThis.atob === "function") return globalThis.atob(b64);
  const { Buffer: bufferCtor } = globalThis as unknown as {
    Buffer?: { from(value: string, encoding: "base64"): { toString(encoding: "utf8"): string } };
  };
  if (bufferCtor) return bufferCtor.from(b64, "base64").toString("utf8");
  throw new Error("Base64 decoding is not available in this runtime");
}

async function rpcCall<T>(rpcUrl: string, method: string, params: unknown[]): Promise<T> {
  const res = await fetch(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(10000),
  });
  const data = (await res.json()) as RpcResponse<T>;
  if (data.error) {
    throw new Error(`${method}: ${data.error.message || "rpc error"}`);
  }
  if (!data.result) throw new Error(`${method}: empty result`);
  return data.result;
}

export function useMorpheusDataFeed(
  config: UseMorpheusDataFeedConfig = {},
): MorpheusDataFeedHandle {
  const network = config.network ?? getNetwork();
  const integration = EXTERNAL_INTEGRATIONS[network];
  const contractHash = integration.contracts.morpheusDatafeed;
  const rpcUrl = config.rpcUrl ?? integration.rpcUrl;

  const error: Observable<string | null> = createObservable<string | null>(null);

  const getPrice = async (asset: string): Promise<number> => {
    error.set(null);
    if (!contractHash) {
      const msg = `MorpheusDataFeed not deployed on ${network}`;
      error.set(msg);
      throw new Error(msg);
    }
    try {
      const pair = normalizeAsset(asset);
      const result = await rpcCall<InvokeResult>(rpcUrl, "invokefunction", [
        contractHash,
        "getLatest",
        [{ type: "String", value: pair }],
      ]);
      if (result.state !== "HALT") {
        throw new Error(`getLatest FAULT: ${result.exception || "unknown"}`);
      }
      const top = result.stack?.[0];
      // Returns Struct: [pair, dataTimestamp, price, recordTimestamp, signature, version_or_active_flag]
      // Note: field [5] looks like an active/version flag (observed value = 1),
      // NOT decimals. TwelveData publishes prices on-chain at a fixed 6-decimal
      // scale (confirmed by the gateway response shape: `decimals: 6,
      // price_scale_decimals: 6`). Use that fixed scale here.
      if (!top || (top.type !== "Struct" && top.type !== "Array")) {
        throw new Error(`getLatest returned unexpected shape: ${top?.type}`);
      }
      const fields = (top.value as NeoStackItem[]) || [];
      const priceField = fields[2];
      if (!priceField || priceField.type !== "Integer") {
        throw new Error(`price field missing or wrong type: ${priceField?.type}`);
      }
      const priceInt = BigInt(String(priceField.value || "0"));
      const PRICE_SCALE = 1_000_000;
      const priceNumber = Number(priceInt) / PRICE_SCALE;
      if (!Number.isFinite(priceNumber)) {
        throw new Error(`price overflow for ${pair}: ${priceField.value}`);
      }
      return priceNumber;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "DataFeed read failed";
      error.set(msg);
      throw e instanceof Error ? e : new Error(msg);
    }
  };

  const listPairs = async (): Promise<string[]> => {
    error.set(null);
    if (!contractHash) {
      throw new Error(`MorpheusDataFeed not deployed on ${network}`);
    }
    const result = await rpcCall<InvokeResult>(rpcUrl, "invokefunction", [
      contractHash,
      "getAllPairs",
      [],
    ]);
    if (result.state !== "HALT") {
      throw new Error(`getAllPairs FAULT: ${result.exception || "unknown"}`);
    }
    const top = result.stack?.[0];
    if (!top || top.type !== "Array") return [];
    const items = (top.value as NeoStackItem[]) || [];
    return items
      .filter((it) => it.type === "ByteString" && typeof it.value === "string")
      .map((it) => decodeBase64String(String(it.value)));
  };

  return {
    network,
    error,
    getPrice,
    listPairs,
  };
}
