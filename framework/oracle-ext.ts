/**
 * app.oracle extensions — dataFeed reader + seal lane
 * (framework-extraction plan §2/S13).
 *
 * Standalone factory with two lanes:
 *
 * - `dataFeed`: the wallet-free Morpheus DataFeed JSON-RPC reader core
 *   ported from apps/shared/composables/useMorpheusDataFeed.ts — reads
 *   prices directly from the deployed contract via `invokefunction`
 *   (canonical AGG:<PAIR> record preferred, per-provider TWELVEDATA:<PAIR>
 *   fallback), plus the pure freshness math neo-swap keys its staleness
 *   banner on.
 *
 * - `seal`: the Morpheus confidential-seal client ported from
 *   apps/private-transfer/src/seal.ts — oracle public-key fetch with TTL
 *   cache and stale fallback, encryption-algorithm pinning, envelope
 *   encryption, and confidential-store submission. Every failure is a
 *   phase-tagged {@link FrameworkSealError} (`key` | `package` | `store`)
 *   so apps can map phases to localized error copy.
 *
 * Out of scope (tracked separately): the Morpheus confidential *reveal*
 * protocol and the EVM lane.
 */
import { FrameworkCapabilityError } from "./aa";
import { retryAsync } from "./utils/async-utils";
import { MiniAppError } from "./utils/errors";
import {
  fetchWithTimeout,
  HttpResponseError,
  isTransientFetchError,
} from "./utils/fetch-timeout";
import { encryptJsonWithOraclePublicKey } from "./utils/morpheus-confidential-envelope";

// ─── shared JSON-RPC plumbing ────────────────────────────────────────────────

/** Per-attempt RPC deadline (unchanged from the composable it replaces). */
const RPC_TIMEOUT_MS = 10000;
/** Bounded retry for transient indexer/RPC read blips. */
const RPC_RETRY_ATTEMPTS = 3;
const RPC_RETRY_BASE_DELAY_MS = 300;
const RPC_RETRY_MAX_DELAY_MS = 1500;

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

function decodeBase64String(b64: string): string {
  if (typeof globalThis.atob === "function") return globalThis.atob(b64);
  const { Buffer: bufferCtor } = globalThis as unknown as {
    Buffer?: { from(value: string, encoding: "base64"): { toString(encoding: "utf8"): string } };
  };
  if (bufferCtor) return bufferCtor.from(b64, "base64").toString("utf8");
  throw new Error("Base64 decoding is not available in this runtime");
}

/**
 * Wrap the injected fetcher (or global fetch, with the framework timeout)
 * exactly like private-transfer's seal client did, so tests and hosts can
 * substitute transport without losing the default deadline.
 */
function resolveFetch(
  fetcher: typeof fetch | undefined,
  timeoutMs: number,
): (input: string, init?: RequestInit) => Promise<Response> {
  return (input, init) => {
    const fn = fetcher ?? globalThis.fetch;
    if (typeof fn !== "function") {
      return Promise.reject(new Error("fetch is unavailable"));
    }
    if (!fetcher || fetcher === globalThis.fetch) {
      return fetchWithTimeout(input, { ...init, timeoutMs });
    }
    return fn(input, init);
  };
}

// ─── dataFeed lane ──────────────────────────────────────────────────────────

export interface FrameworkDataFeedDeps {
  /** JSON-RPC endpoint used for read-only `invokefunction` calls. */
  rpcUrl: string;
  /** Deployed MorpheusDataFeed contract hash; empty ⇒ feed unavailable. */
  contractHash: string;
  /** Network label used only for error copy (e.g. "testnet"). */
  network?: string;
  /** Test/transport override; defaults to global fetch with a 10s timeout. */
  fetcher?: typeof fetch;
}

/**
 * A price read together with the feed's own freshness metadata. Timestamps
 * are epoch SECONDS as stored in the on-chain struct; `0` when omitted.
 */
export interface FrameworkDataFeedQuote {
  /** Price in quote-currency units (on-chain integer descaled by 10^6). */
  price: number;
  /** When the upstream source produced the value (field [1]). */
  dataTimestamp: number;
  /** When the value was written on-chain (field [3]) — the freshness signal. */
  recordTimestamp: number;
}

export interface FrameworkDataFeedFreshness {
  /** On-chain write time in epoch ms; 0 when the feed never wrote. */
  recordTimestampMs: number;
  /** Upstream-source time in epoch ms (display "as of"); 0 when omitted. */
  dataTimestampMs: number;
  /** Age of the on-chain record in ms; null when the feed never wrote. */
  ageMs: number | null;
  stale: boolean;
}

/**
 * Freshness math for a dataFeed quote (pure; exported for direct reuse).
 *
 * Keyed on the on-chain `recordTimestamp`, NOT the upstream `dataTimestamp`:
 * the feed keeps returning HALT with its last value even when updates
 * stopped, so on-chain write time is the freshness signal, and the upstream
 * source time can lag (e.g. on testnet) without making a live feed "stale".
 *
 * Fail-closed: a quote we cannot prove is live must not be treated fresh —
 * a missing/zero `recordTimestamp` (never-written feed) and a non-numeric
 * `staleMs` both report `stale: true`.
 */
export function dataFeedFreshness(
  record: { recordTimestamp?: number; dataTimestamp?: number } | null | undefined,
  staleMs: number,
  nowMs: number = Date.now(),
): FrameworkDataFeedFreshness {
  const toMs = (seconds: unknown): number => {
    const parsed = Number(seconds ?? 0);
    return Number.isFinite(parsed) && parsed > 0 ? parsed * 1000 : 0;
  };
  const recordTimestampMs = toMs(record?.recordTimestamp);
  const dataTimestampMs = toMs(record?.dataTimestamp);
  if (recordTimestampMs <= 0) {
    return { recordTimestampMs: 0, dataTimestampMs, ageMs: null, stale: true };
  }
  const ageMs = nowMs - recordTimestampMs;
  const limit = Number(staleMs);
  return {
    recordTimestampMs,
    dataTimestampMs,
    ageMs,
    stale: Number.isNaN(limit) ? true : ageMs > limit,
  };
}

/**
 * Bare `BASE-QUOTE` pair (e.g. "NEO-USD") for an asset, with no provider
 * prefix. Shared by the per-provider and canonical key builders so both
 * resolve the same underlying pair (NEO → NEO-USD, NEO/USD → NEO-USD).
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
 * Canonical aggregated storage key for an asset: `AGG:<BASE-QUOTE>`. The
 * oracle writes this multi-provider, cross-checked record per pair; reads
 * prefer it and fall back to the per-provider TWELVEDATA pair when absent.
 */
function canonicalAsset(asset: string): string {
  return `AGG:${basePair(asset)}`;
}

// ─── seal lane ──────────────────────────────────────────────────────────────

export type FrameworkSealPhase = "key" | "package" | "store";

/**
 * Phase-tagged seal failure: `key` (oracle public-key fetch), `package`
 * (algorithm pinning / envelope encryption), `store` (confidential store).
 * Identity-stable exported class — apps map phases to localized error copy.
 */
export class FrameworkSealError extends MiniAppError {
  readonly phase: FrameworkSealPhase;

  constructor(phase: FrameworkSealPhase, error: unknown) {
    const message = error instanceof Error
      ? error.message
      : String(error ?? "Oracle sealing failed");
    super(message, "ORACLE_SEAL_ERROR", undefined, { phase, cause: error });
    this.name = "FrameworkSealError";
    this.phase = phase;
  }
}

/** Pinned envelope algorithm; a key advertising anything else is rejected. */
export const MORPHEUS_ENCRYPTION_ALGORITHM = "X25519-HKDF-SHA256-AES-256-GCM";

const SEAL_PUBLIC_KEY_URL = "/api/morpheus/oracle/public-key";
const SEAL_STORE_URL = "/api/morpheus/confidential/store";
const SEAL_PUBLIC_KEY_TTL_MS = 5 * 60_000;

export interface FrameworkSealDeps {
  /** Network sent to the seal endpoints (default "testnet"). */
  network?: string;
  /** Default `app_id` for store submissions (falls back to the factory appId). */
  appId?: string;
  /** Test/transport override; defaults to global fetch with a 10s timeout. */
  fetcher?: typeof fetch;
  /** Override the public-key endpoint (default {@link SEAL_PUBLIC_KEY_URL}-style). */
  publicKeyUrl?: string;
  /** Override the confidential-store endpoint. */
  storeUrl?: string;
  /** Public-key cache TTL in ms (default 5 minutes). */
  publicKeyTtlMs?: number;
  /** Pinned encryption algorithm (default {@link MORPHEUS_ENCRYPTION_ALGORITHM}). */
  algorithm?: string;
  /** Clock override for TTL tests. */
  now?: () => number;
}

export interface FrameworkSealPublicKey {
  /** Raw X25519 public key, base64. */
  publicKey: string;
  algorithm: string;
  contract: string;
  network: string;
  /** When this key was fetched (epoch ms). */
  fetchedAt: number;
  /** True when served from an expired cache after a failed refresh. */
  stale: boolean;
}

export interface FrameworkSealStoreInput {
  /** Store entry name (e.g. `private-transfer:<commitment>`). */
  name: string;
  /** Envelope ciphertext produced by {@link createOracleExtensions} `seal.encrypt`. */
  ciphertext: string;
  /** Optional public (plaintext) envelope stored alongside the ciphertext. */
  publicEnvelope?: Record<string, unknown>;
  network?: string;
  appId?: string;
  /** Target chain marker (default "neo_n3"). */
  targetChain?: string;
}

export interface FrameworkSealStoreResult {
  secretRef: string;
  raw: Record<string, unknown>;
}

// ─── factory ────────────────────────────────────────────────────────────────

export interface FrameworkOracleExtensionsDeps {
  appId?: string;
  /** DataFeed lane config; absent ⇒ price/listPairs throw a capability error. */
  dataFeed?: FrameworkDataFeedDeps;
  seal?: FrameworkSealDeps;
}

export function createOracleExtensions(deps: FrameworkOracleExtensionsDeps = {}) {
  // ── dataFeed ──────────────────────────────────────────────────────────────
  const feedFetch = resolveFetch(deps.dataFeed?.fetcher, RPC_TIMEOUT_MS);

  const requireFeed = (): FrameworkDataFeedDeps => {
    const feed = deps.dataFeed;
    if (!feed || !feed.contractHash) {
      throw new FrameworkCapabilityError(
        "oracle.dataFeed",
        `MorpheusDataFeed not deployed on ${feed?.network ?? "this host"}`,
      );
    }
    return feed;
  };

  // Read-only `invokefunction` test-invocations — idempotent, so a transient
  // RPC node blip (timeout, network drop, 429/5xx) retries with bounded
  // backoff instead of hard-failing the read. A JSON-RPC-level error (method
  // not found, bad params) is deterministic and rethrown without retry.
  const rpcCall = async <T>(rpcUrl: string, method: string, params: unknown[]): Promise<T> =>
    retryAsync<T>(
      async () => {
        const res = await feedFetch(rpcUrl, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
        });
        if (!res.ok) {
          throw new HttpResponseError(`${method}: rpc HTTP ${res.status}`, res.status);
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

  const parseTimestampField = (field: NeoStackItem | undefined): number => {
    if (!field || field.type !== "Integer") return 0;
    const parsed = Number(String(field.value ?? "0"));
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  };

  /**
   * Read a single pair record. Returns the parsed quote, or `null` when the
   * contract has no usable record for the pair (a FAULT — e.g. "pair not
   * registered" — or an unexpected/empty stack). A `null` is a contract-level
   * miss the caller can fall back from; transport errors still throw so a
   * network outage is never silently treated as a missing pair.
   */
  const readPair = async (pair: string): Promise<FrameworkDataFeedQuote | null> => {
    const feed = requireFeed();
    const result = await rpcCall<InvokeResult>(feed.rpcUrl, "invokefunction", [
      feed.contractHash,
      "getLatest",
      [{ type: "String", value: pair }],
    ]);
    if (result.state !== "HALT") return null;
    const top = result.stack?.[0];
    // Returns Struct: [pair, dataTimestamp, price, recordTimestamp, signature,
    // version_or_active_flag]. Timestamps are epoch SECONDS; prices publish
    // at a fixed 6-decimal scale (field [5] is an active/version flag, NOT
    // decimals — verified live against the mainnet feed).
    if (!top || (top.type !== "Struct" && top.type !== "Array")) return null;
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

  const quoteOf = async (asset: string): Promise<FrameworkDataFeedQuote> => {
    requireFeed();
    // Prefer the canonical multi-provider AGG:<PAIR> record when the contract
    // has it; fall back to the per-provider TWELVEDATA:<PAIR> record so feeds
    // that only publish per-provider records keep working unchanged. A
    // caller-supplied source-prefixed asset is read directly.
    const fallbackPair = normalizeAsset(asset);
    const explicitPrefix = String(asset || "").includes(":");
    if (!explicitPrefix) {
      const canonical = await readPair(canonicalAsset(asset));
      if (canonical) return canonical;
    }
    const quote = await readPair(fallbackPair);
    if (quote) return quote;
    throw new Error(`getLatest FAULT: no record for ${fallbackPair}`);
  };

  async function price(pair: string): Promise<number>;
  async function price(pair: string, opts: { meta: true }): Promise<FrameworkDataFeedQuote>;
  async function price(
    pair: string,
    opts?: { meta?: boolean },
  ): Promise<number | FrameworkDataFeedQuote> {
    const quote = await quoteOf(pair);
    return opts?.meta ? quote : quote.price;
  }

  const listPairs = async (): Promise<string[]> => {
    const feed = requireFeed();
    const result = await rpcCall<InvokeResult>(feed.rpcUrl, "invokefunction", [
      feed.contractHash,
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

  // ── seal ──────────────────────────────────────────────────────────────────
  const sealDeps = deps.seal ?? {};
  const sealNetwork = String(sealDeps.network || "testnet");
  const sealNow = sealDeps.now ?? Date.now;
  const sealTtlMs = sealDeps.publicKeyTtlMs ?? SEAL_PUBLIC_KEY_TTL_MS;
  const pinnedAlgorithm = sealDeps.algorithm ?? MORPHEUS_ENCRYPTION_ALGORITHM;
  const sealFetch = resolveFetch(sealDeps.fetcher, RPC_TIMEOUT_MS);

  const sealJson = async (
    input: string,
    init?: RequestInit,
  ): Promise<{ ok: boolean; body: Record<string, unknown> }> => {
    const response = await sealFetch(input, init);
    const body = await response.json().catch(() => ({}));
    return {
      ok: response.ok,
      body: body && typeof body === "object" ? body as Record<string, unknown> : {},
    };
  };

  let cachedKey: { value: Omit<FrameworkSealPublicKey, "stale">; } | null = null;

  const publicKey = async (
    opts: { forceRefresh?: boolean } = {},
  ): Promise<FrameworkSealPublicKey> => {
    if (
      cachedKey &&
      !opts.forceRefresh &&
      sealNow() - cachedKey.value.fetchedAt < sealTtlMs
    ) {
      return { ...cachedKey.value, stale: false };
    }
    try {
      const url = sealDeps.publicKeyUrl
        ?? `${SEAL_PUBLIC_KEY_URL}?network=${encodeURIComponent(sealNetwork)}`;
      const key = await sealJson(url, { headers: { accept: "application/json" } });
      if (!key.ok || !key.body.public_key) {
        throw new Error(String(key.body.error || "Morpheus oracle public key is unavailable"));
      }
      const algorithm = String(key.body.algorithm || "");
      if (algorithm && algorithm !== pinnedAlgorithm) {
        // Algorithm-pin failures are policy errors, not availability blips —
        // they must never be masked by the stale-cache fallback below.
        throw new FrameworkSealError(
          "package",
          `Unsupported Morpheus encryption algorithm: ${algorithm}`,
        );
      }
      cachedKey = {
        value: {
          publicKey: String(key.body.public_key),
          algorithm: algorithm || pinnedAlgorithm,
          contract: String(key.body.contract || ""),
          network: sealNetwork,
          fetchedAt: sealNow(),
        },
      };
      return { ...cachedKey.value, stale: false };
    } catch (error) {
      if (error instanceof FrameworkSealError && error.phase !== "key") throw error;
      // Stale fallback: an expired cached key still encrypts valid envelopes
      // (key rotation is slow), so prefer it over failing the whole seal flow.
      if (cachedKey) return { ...cachedKey.value, stale: true };
      throw error instanceof FrameworkSealError ? error : new FrameworkSealError("key", error);
    }
  };

  const encrypt = async (
    payload: unknown,
  ): Promise<{ ciphertext: string; key: FrameworkSealPublicKey }> => {
    const key = await publicKey();
    try {
      const ciphertext = await encryptJsonWithOraclePublicKey(key.publicKey, payload);
      return { ciphertext, key };
    } catch (error) {
      throw error instanceof FrameworkSealError
        ? error
        : new FrameworkSealError("package", error);
    }
  };

  const store = async (input: FrameworkSealStoreInput): Promise<FrameworkSealStoreResult> => {
    try {
      const stored = await sealJson(sealDeps.storeUrl ?? SEAL_STORE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          network: input.network ?? sealNetwork,
          target_chain: input.targetChain ?? "neo_n3",
          app_id: input.appId ?? sealDeps.appId ?? deps.appId ?? "",
          name: input.name,
          ciphertext: input.ciphertext,
          ...(input.publicEnvelope !== undefined
            ? { public_envelope: input.publicEnvelope }
            : {}),
        }),
      });
      if (!stored.ok || stored.body.inline_fallback) {
        throw new Error(
          String(stored.body.error || stored.body.message || "Morpheus confidential store is unavailable"),
        );
      }
      const secretRef = String(
        stored.body.secret_ref || stored.body.id || stored.body.ref || "",
      ).trim();
      if (!secretRef) {
        throw new Error("Morpheus confidential store did not return a secret reference");
      }
      return { secretRef, raw: stored.body };
    } catch (error) {
      throw error instanceof FrameworkSealError ? error : new FrameworkSealError("store", error);
    }
  };

  return {
    dataFeed: {
      /** Whether the host has a deployed dataFeed (reads throw when false). */
      get available(): boolean {
        return Boolean(deps.dataFeed?.contractHash);
      },
      price,
      listPairs,
      freshness: dataFeedFreshness,
    },
    seal: {
      publicKey,
      encrypt,
      store,
    },
  };
}

export type FrameworkOracleExtensions = ReturnType<typeof createOracleExtensions>;
