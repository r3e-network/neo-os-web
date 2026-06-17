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
 *   - data freshness depends on how often the Nitro TEE pushes updates
 *     to the contract (currently every few hours in normal operation)
 *   - no per-call TEE attestation, and NO ECDSA signature is verifiable
 *     on-chain: the struct's "signature" field carries only a sha256
 *     attestation digest, not a recoverable signature over the price. The
 *     on-chain trust path is therefore the registered updater's witness
 *     (only the authorized writer can set the record) plus the producer-side
 *     TEE guards at write time — it is NOT equivalent to verifying a signed
 *     HTTP response per call.
 */
import { createObservable } from "@shared/react/context";
import type { Observable } from "@shared/react/context";
import { EXTERNAL_INTEGRATIONS, type NeoNetwork, getNetwork } from "../constants/rpc";

export interface UseMorpheusDataFeedConfig {
  network?: NeoNetwork;
  rpcUrl?: string;
}

/**
 * A price read together with the feed's own freshness metadata, so callers
 * can tell a live quote from a frozen feed (the on-chain record keeps
 * returning HALT with its last value even when updates stopped months ago).
 */
export interface MorpheusPriceQuote {
  /** Price in quote-currency units (on-chain integer descaled by 10^6). */
  price: number;
  /**
   * When the upstream source produced the value (epoch seconds, field [1]
   * of the on-chain struct). `0` when the contract omits it.
   */
  dataTimestamp: number;
  /**
   * When the value was written on-chain (epoch seconds, field [3] of the
   * on-chain struct). `0` when the contract omits it.
   */
  recordTimestamp: number;
}

export interface MorpheusDataFeedHandle {
  network: NeoNetwork;
  error: Observable<string | null>;
  getPrice: (asset: string) => Promise<number>;
  getPriceWithMeta: (asset: string) => Promise<MorpheusPriceQuote>;
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

  const parseTimestampField = (field: NeoStackItem | undefined): number => {
    if (!field || field.type !== "Integer") return 0;
    const parsed = Number(String(field.value ?? "0"));
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  };

  const getPriceWithMeta = async (asset: string): Promise<MorpheusPriceQuote> => {
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
      // Timestamps are epoch SECONDS (verified live against the mainnet feed).
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
      return {
        price: priceNumber,
        dataTimestamp: parseTimestampField(fields[1]),
        recordTimestamp: parseTimestampField(fields[3]),
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "DataFeed read failed";
      error.set(msg);
      throw e instanceof Error ? e : new Error(msg);
    }
  };

  const getPrice = async (asset: string): Promise<number> => {
    const quote = await getPriceWithMeta(asset);
    return quote.price;
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
    getPriceWithMeta,
    listPairs,
  };
}
