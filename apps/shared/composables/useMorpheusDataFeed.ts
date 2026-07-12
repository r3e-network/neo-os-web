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
import { fetchWithTimeout, HttpResponseError, isTransientFetchError } from "../utils/fetch-timeout";
import { retryAsync } from "../utils/async-utils";

/** Per-attempt RPC deadline (unchanged from the prior inline value). */
const RPC_TIMEOUT_MS = 10000;
/** Bounded retry for transient indexer/RPC read blips. */
const RPC_RETRY_ATTEMPTS = 3;
const RPC_RETRY_BASE_DELAY_MS = 300;
const RPC_RETRY_MAX_DELAY_MS = 1500;

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

/**
 * Bare `BASE-QUOTE` pair (e.g. "NEO-USD") for an asset, with no provider/source
 * prefix. Shared by the per-provider and canonical key builders so both resolve
 * the same underlying pair (NEO → NEO-USD, NEO/USD → NEO-USD).
 */
function basePair(asset: string): string {
  const v = String(asset || "").trim().toUpperCase();
  if (!v) throw new Error("asset is required");
  const colon = v.indexOf(":");
  const bare = colon >= 0 ? v.slice(colon + 1) : v;
  if (bare.includes("/")) return bare.replace("/", "-");
  if (bare.includes("-")) return bare;
  return `${bare}-USD`;
}

function normalizeAsset(asset: string): string {
  const v = String(asset || "").trim().toUpperCase();
  if (!v) throw new Error("asset is required");
  // A caller-supplied source-prefixed pair (e.g. an explicit provider record)
  // is honoured verbatim — only bare assets get the default TWELVEDATA mapping.
  if (v.includes(":")) return v;
  return `TWELVEDATA:${basePair(v)}`;
}

/**
 * Canonical aggregated storage key for an asset: `AGG:<BASE-QUOTE>`. The oracle
 * writes this multi-provider, cross-checked record per pair (a single source can
 * never be laundered into it). Preferred over the per-provider TWELVEDATA pair
 * when the contract has the canonical record; reads fall back to TWELVEDATA when
 * it is absent (a FAULT/empty getLatest), so this stays backward compatible with
 * feeds that only publish per-provider records.
 */
function canonicalAsset(asset: string): string {
  return `AGG:${basePair(asset)}`;
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
  // Read-only `invokefunction` test-invocations — idempotent, so a transient
  // RPC node blip (timeout, network drop, 429/5xx) retries with bounded backoff
  // instead of hard-failing the price read. A JSON-RPC-level error (method not
  // found, bad params) is deterministic and is rethrown without retry.
  return retryAsync<T>(
    async () => {
      const res = await fetchWithTimeout(rpcUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
        timeoutMs: RPC_TIMEOUT_MS,
      });
      if (!res.ok) {
        throw new HttpResponseError(
          `${method}: rpc HTTP ${res.status}`,
          res.status,
        );
      }
      const data = (await res.json()) as RpcResponse<T>;
      if (data.error) {
        throw new Error(`${method}: ${data.error.message || "rpc error"}`);
      }
      if (!data.result) throw new Error(`${method}: empty result`);
      return data.result;
    },
    {
      maxAttempts: RPC_RETRY_ATTEMPTS,
      baseDelayMs: RPC_RETRY_BASE_DELAY_MS,
      maxDelayMs: RPC_RETRY_MAX_DELAY_MS,
      shouldRetry: isTransientFetchError,
    },
  );
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

  /**
   * Read a single pair record. Returns the parsed quote, or `null` when the
   * contract has no usable record for the pair (a FAULT — e.g. "pair not
   * registered" — or an unexpected/empty stack). A `null` is a contract-level
   * miss the caller can fall back from; transport errors (RPC failure) still
   * throw so a network outage is never silently treated as a missing pair.
   */
  const readPair = async (pair: string): Promise<MorpheusPriceQuote | null> => {
    const result = await rpcCall<InvokeResult>(rpcUrl, "invokefunction", [
      contractHash,
      "getLatest",
      [{ type: "String", value: pair }],
    ]);
    if (result.state !== "HALT") {
      // A FAULT means the pair has no record (not a transport failure) — let the
      // caller fall back to another key rather than aborting the read.
      return null;
    }
    const top = result.stack?.[0];
    // Returns Struct: [pair, dataTimestamp, price, recordTimestamp, signature, version_or_active_flag]
    // Timestamps are epoch SECONDS (verified live against the mainnet feed).
    // Note: field [5] looks like an active/version flag (observed value = 1),
    // NOT decimals. TwelveData publishes prices on-chain at a fixed 6-decimal
    // scale (confirmed by the gateway response shape: `decimals: 6,
    // price_scale_decimals: 6`). Use that fixed scale here.
    if (!top || (top.type !== "Struct" && top.type !== "Array")) {
      return null;
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
  };

  const getPriceWithMeta = async (asset: string): Promise<MorpheusPriceQuote> => {
    error.set(null);
    if (!contractHash) {
      const msg = `MorpheusDataFeed not deployed on ${network}`;
      error.set(msg);
      throw new Error(msg);
    }
    try {
      // Prefer the canonical multi-provider AGG:<PAIR> record when the contract
      // has it; fall back to the per-provider TWELVEDATA:<PAIR> record so feeds
      // that only publish per-provider records keep working unchanged. A
      // caller-supplied source-prefixed asset (normalizeAsset keeps its prefix)
      // is read directly without the canonical attempt.
      const fallbackPair = normalizeAsset(asset);
      const explicitPrefix = String(asset || "").includes(":");
      if (!explicitPrefix) {
        const canonical = await readPair(canonicalAsset(asset));
        // A deployed canonical pair can exist as an all-zero placeholder before
        // the aggregator publishes its first record. Treat that as absent for
        // preference purposes so the current provider record remains usable.
        // Explicit provider reads still return their raw metadata (including a
        // zero timestamp) for callers that need to diagnose malformed records.
        if (canonical && canonical.price > 0 && canonical.recordTimestamp > 0) {
          return canonical;
        }
      }
      const quote = await readPair(fallbackPair);
      if (quote) return quote;
      throw new Error(`getLatest FAULT: no record for ${fallbackPair}`);
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
