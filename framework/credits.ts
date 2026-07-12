/**
 * app.credits — the platform credit surface (Credits v2, DB-first spends).
 *
 * THE one uniform lane every miniapp consumes for platform credits; apps
 * never talk to the credits-ledger edge function or the MiniAppCredits
 * contract directly. Architecture (docs/MINIAPP_CREDITS_LEDGER.md):
 *
 * - BUY is ON-CHAIN: `buy(gasAmount)` transfers GAS from the connected
 *   wallet to the MiniAppCredits contract with the `"miniapp-credits:buy"`
 *   memo. The contract mints `floor(gas / 0.02 GAS)` credits and emits
 *   `CreditsPurchased`; the platform indexer then credits the interactive DB
 *   balance, which `buy` polls for (bounded) so the app knows when the
 *   credits are spendable. Guest mode blocks it; the S11 `payments` manifest
 *   permission gates it (buys are the only on-chain user action here).
 * - SPEND is DB-FIRST: `spend(amount, action)` POSTs to the credits-ledger
 *   endpoint — an instant, feeless, idempotent DB debit. NO transaction, NO
 *   wallet popup, NO S11 payments gate (that permission covers on-chain
 *   payments only). Guest mode blocks it (credits are a GAS-backed feature).
 * - The chain remains the auditable anchor: purchases are proven by
 *   `CreditsPurchased`, off-chain spends are checkpointed by periodic
 *   operator-signed settlement epochs, and `settledBalanceOf` is the
 *   user-exitable on-chain balance. When the ledger is unreachable,
 *   `balance()` falls back to that settled chain read and FLAGS the result
 *   `stale: true` / `source: "chain"` — it does NOT include unsettled
 *   activity since the last epoch. Honest trade-off: between settlements the
 *   DB is authoritative; the contract's `exit(user)` path is the user's
 *   unilateral escape hatch for the last settled balance.
 *
 * AUTH (repo idiom): the ledger authenticates the platform session (Supabase
 * JWT / API key via the injected token resolvers, cookies included) and
 * resolves the caller's signature-verified primary wallet binding — the
 * wallet signature was verified at bind time by wallet-bind/auth-wallet, so
 * there is NO per-request raw signature. The connected wallet address is
 * sent as the optional `wallet` body field so a session/wallet mismatch
 * fails fast with 403 ADDRESS_MISMATCH.
 *
 * Config comes from `MiniAppFrameworkOptions.credits` (platform config
 * pattern, like `oracle.dataFeed`): the app layer injects the ledger URL and
 * the network's deployed MiniAppCredits contract hash. Absent/invalid config
 * throws a typed {@link FrameworkCapabilityError} (capability "credits").
 */

import { FrameworkCapabilityError } from "./aa";
import type { Observable } from "./reactive";
import { createObservable } from "./reactive";
import { retryAsync } from "./utils/async-utils";
import { MiniAppError } from "./utils/errors";
import {
  DEFAULT_FETCH_TIMEOUT_MS,
  fetchWithTimeout,
  HttpResponseError,
  isTransientFetchError,
} from "./utils/fetch-timeout";
import { addressToScriptHash } from "./utils/neo";

// ─── rate constants + pure rate math ────────────────────────────────────────

/** Fixed contract rate: credits minted per 1 GAS. */
export const CREDITS_PER_GAS = 50n;
/** Fixed contract rate: GAS base units (fixed8) per 1 credit (= 0.02 GAS). */
export const GAS_BASE_UNITS_PER_CREDIT = 2_000_000n;
/** NEP-17 transfer data (memo) that routes a GAS payment into a credit buy. */
export const CREDITS_BUY_MEMO = "miniapp-credits:buy";
/** Native GAS token contract (identical on mainnet and testnet). */
export const GAS_TOKEN_HASH = "0xd2a4cff31913016155e38e474a2c06d08be276cf";

/**
 * Parse a GAS amount into fixed8 BASE UNITS with THROW semantics (the
 * app.amount.gasToFixed8 convention): bigint inputs are base units already;
 * number/string inputs are decimal GAS. Buys must reject bad input loudly,
 * not silently coerce to 0.
 */
function gasAmountToFixed8(value: bigint | number | string): bigint {
  if (typeof value === "bigint") {
    if (value <= 0n) throw new Error("GAS amount must be positive");
    return value;
  }
  const raw = typeof value === "number"
    ? Number.isFinite(value)
      ? value.toFixed(8).replace(/\.?0+$/, "")
      : ""
    : String(value ?? "").trim();
  if (raw.startsWith("-")) throw new Error("GAS amount cannot be negative");
  if (!/^\d+(?:\.\d+)?$/.test(raw)) {
    throw new Error("GAS amount must be a positive decimal amount");
  }
  const [whole = "0", fraction = ""] = raw.split(".");
  if (fraction.length > 8) throw new Error("GAS amount cannot have more than 8 decimals");
  const fixed8 = BigInt(whole) * 100_000_000n + BigInt(fraction.padEnd(8, "0") || "0");
  if (fixed8 <= 0n) throw new Error("GAS amount must be positive");
  return fixed8;
}

/**
 * Credits minted for a GAS payment — the contract's exact floor math
 * (`floor(gasBaseUnits / 2_000_000)`). bigint inputs are GAS BASE UNITS;
 * number/string inputs are decimal GAS ("0.5", 0.02).
 */
export function creditsForGas(gasAmount: bigint | number | string): bigint {
  return gasAmountToFixed8(gasAmount) / GAS_BASE_UNITS_PER_CREDIT;
}

/**
 * Decimal GAS string a credit count costs at the fixed rate
 * (e.g. `gasForCredits(50) === "1"`, `gasForCredits(1) === "0.02"`).
 */
export function gasForCredits(credits: bigint | number | string): string {
  const raw = typeof credits === "bigint" ? credits : BigInt(String(credits ?? "").trim());
  if (raw <= 0n) throw new Error("credit amount must be a positive integer");
  const fixed8 = raw * GAS_BASE_UNITS_PER_CREDIT;
  const whole = fixed8 / 100_000_000n;
  const fraction = (fixed8 % 100_000_000n).toString().padStart(8, "0").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole.toString();
}

// ─── typed errors ───────────────────────────────────────────────────────────

/**
 * Ledger/credit failure with a stable machine code (mirrors the edge
 * function's error envelope codes, e.g. "ADDRESS_MISMATCH",
 * "AMOUNT_TOO_LARGE") plus the HTTP status when one was observed.
 * Identity-stable exported class — apps branch on `instanceof` and `code`.
 */
export class FrameworkCreditsError extends MiniAppError {
  /** HTTP status of the ledger response, when the failure was HTTP-level. */
  readonly httpStatus?: number;

  constructor(message: string, code: string, httpStatus?: number, details?: unknown) {
    super(message, code, undefined, details);
    this.name = "FrameworkCreditsError";
    if (httpStatus !== undefined) this.httpStatus = httpStatus;
  }
}

/**
 * Typed insufficient-balance failure for `spend` (the ledger's 402
 * INSUFFICIENT_CREDITS). `balance` is the last locally-known balance (from
 * `app.credits.current`) — informational only; the ledger is authoritative.
 */
export class FrameworkInsufficientCreditsError extends FrameworkCreditsError {
  /** Credits the rejected spend asked for. */
  readonly required: number;
  /** Last locally-known balance when the spend was rejected; null if unknown. */
  readonly balance: number | null;

  constructor(required: number, balance: number | null) {
    super(
      `Insufficient credits: spend of ${required} rejected${
        balance === null ? "" : ` (last known balance ${balance})`
      }`,
      "INSUFFICIENT_CREDITS",
      402,
      { required, balance },
    );
    this.name = "FrameworkInsufficientCreditsError";
    this.required = required;
    this.balance = balance;
  }
}

// ─── config + result types ──────────────────────────────────────────────────

export type FrameworkCreditsNetwork = "mainnet" | "testnet";

/**
 * Platform-injected credits config (`MiniAppFrameworkOptions.credits`).
 * Absent or invalid ⇒ every surface method throws a typed
 * {@link FrameworkCapabilityError} naming what is missing.
 */
export interface FrameworkCreditsConfig {
  /** credits-ledger endpoint URL (absolute, or host-relative like "/api/credits"). */
  ledgerUrl: string;
  /** Deployed MiniAppCredits contract hash for the network ("0x" + 40 hex). */
  contractHash: string;
  /** Ledger network; defaults to the host chain's detected network. */
  network?: FrameworkCreditsNetwork;
  /** Native GAS token contract override (tests); default {@link GAS_TOKEN_HASH}. */
  gasTokenHash?: string;
  /** Supabase session JWT resolver → `Authorization: Bearer` header. */
  getAuthToken?: () => string | null | undefined | Promise<string | null | undefined>;
  /** API-key resolver → `X-API-Key` header (scope name "credits-ledger"). */
  getAPIKey?: () => string | null | undefined | Promise<string | null | undefined>;
  /** Test/transport override; defaults to global fetch with a 10s deadline. */
  fetcher?: typeof fetch;
  /** Ledger polls after a buy before giving up (default 10). */
  buyPollAttempts?: number;
  /** Delay before each buy ledger poll in ms (default 3000). */
  buyPollDelayMs?: number;
  /** Deadline for the best-effort CreditsPurchased event wait (default 30s). */
  waitForEventTimeoutMs?: number;
  /** Transient-read retry attempts for ledger GETs (default 3). */
  readRetryAttempts?: number;
  /** Delay injection for tests. */
  delay?: (ms: number) => Promise<void>;
}

/**
 * A credit balance read. `source: "ledger"` is the live interactive truth;
 * `source: "chain"` is the LAST SETTLED on-chain checkpoint served only when
 * the ledger is unreachable — it excludes unsettled purchases/spends since
 * the last settlement epoch, which is why it is flagged `stale`.
 */
export interface FrameworkCreditsBalance {
  wallet: string;
  network: string;
  /** Spendable credits (integer). */
  balance: number;
  /** Lifetime totals (ledger reads only; 0 on the chain fallback). */
  totalPurchased: number;
  totalSpent: number;
  totalExited: number;
  /** Ledger row timestamp; null when never written or on the chain fallback. */
  updatedAt: string | null;
  source: "ledger" | "chain";
  /** True when served from the settled chain checkpoint (ledger unreachable). */
  stale: boolean;
}

export type FrameworkCreditsEventType = "purchase" | "spend" | "exit";

/** One append-only ledger event (newest first in {@link history}). */
export interface FrameworkCreditsEvent {
  id: number;
  eventType: FrameworkCreditsEventType;
  /** Signed credits: purchases positive, spends/exits negative. */
  amount: number;
  balanceAfter: number;
  appId: string | null;
  action: string | null;
  idempotencyKey: string | null;
  /** Chain anchor for purchase/exit events. */
  txHash: string | null;
  /** GAS base units for purchase/exit events (string; may exceed 2^53). */
  gasAmount: string | null;
  createdAt: string;
}

export interface FrameworkCreditsSpendResult {
  appId: string;
  action: string;
  network: string;
  /** Credits debited. */
  spent: number;
  /** Ledger balance after the debit. */
  balance: number;
  eventId: number | string | null;
  /** True when the idempotency key matched an earlier spend (retry replay). */
  deduped: boolean;
  /** The idempotency key that was sent (generated unless overridden). */
  idempotencyKey: string;
}

export interface FrameworkCreditsBuyResult {
  /** Txid of the broadcast GAS transfer. */
  txid: string;
  /** GAS base units transferred. */
  gasFixed8: string;
  /** Credits the contract mints for that amount (client-side rate math). */
  credits: number;
  /**
   * True once the ledger reflected the purchase within the poll budget.
   * False does NOT mean the buy failed — the transfer is broadcast and the
   * indexer may simply lag; keep polling via `refresh()`.
   */
  credited: boolean;
  /** Latest ledger balance observed while polling; null when unreachable. */
  balance: FrameworkCreditsBalance | null;
  /** Decoded CreditsPurchased event when the host chain lane observed it. */
  event: unknown | null;
}

/** Per-spend overrides (`meta` argument of {@link FrameworkCreditsSurface.spend}). */
export interface FrameworkCreditsSpendMeta {
  /**
   * Caller-managed idempotency key (`[-_a-zA-Z0-9:.]{8,128}`). Pass the SAME
   * key when retrying a spend the app already attempted — the ledger replays
   * the original outcome (`deduped: true`) instead of double-debiting.
   * Omitted ⇒ a fresh unique key is generated per call.
   */
  idempotencyKey?: string;
  /** Ledger network override for this call. */
  network?: FrameworkCreditsNetwork;
}

// ─── surface + deps ─────────────────────────────────────────────────────────

/** Chain lanes the credits surface consumes (subset of the host service). */
export interface CreditsSurfaceChain {
  address: Observable<string | null>;
  ensureWallet(): Promise<string>;
  detectNetwork(): Promise<string>;
  read(
    operation: string,
    args?: Array<{ type: string; value: unknown }>,
    options?: unknown,
  ): Promise<unknown>;
  invoke(
    operation: string,
    args: Array<{ type: string; value: unknown }>,
    options?: { scriptHash?: string },
  ): Promise<{ txid: string; success?: boolean }>;
  waitForEvent?(txid: string, eventName: string, timeoutMs?: number): Promise<unknown>;
}

export interface CreditsSurfaceDeps {
  appId: string;
  chain: CreditsSurfaceChain;
  /** Guest guard shared with every other GAS-backed write lane. */
  assertNotGuest: () => void;
  /** S11 gate for the on-chain buy lane (the "payments" manifest permission). */
  requireBuyPermission: () => void;
  config?: FrameworkCreditsConfig;
}

export interface FrameworkCreditsSurface {
  /** True when the host injected a valid credits config. */
  readonly available: boolean;
  /** Last balance read (ledger or stale chain fallback); null until first read. */
  current: Observable<FrameworkCreditsBalance | null>;
  /** Fast ledger balance read; falls back to settledBalanceOf (stale) on outage. */
  balance(): Promise<FrameworkCreditsBalance>;
  /** Alias of {@link balance} for observable-refresh call sites. */
  refresh(): Promise<FrameworkCreditsBalance>;
  /** On-chain GAS → credits purchase; resolves once broadcast + ledger-polled. */
  buy(gasAmount: bigint | number | string): Promise<FrameworkCreditsBuyResult>;
  /** Instant feeless DB spend (idempotent, single-flight per action; NO chain tx). */
  spend(
    amount: number,
    action: string,
    meta?: FrameworkCreditsSpendMeta,
  ): Promise<FrameworkCreditsSpendResult>;
  /** Cheap affordability check against the cached (or freshly read) balance. */
  canAfford(amount: number): Promise<boolean>;
  /** Recent ledger events, newest first (limit 1..100, default 20). */
  history(limit?: number): Promise<FrameworkCreditsEvent[]>;
  /** Fixed-rate helpers (1 GAS = 50 credits). */
  rate: {
    creditsPerGas: number;
    /** GAS base units per credit (fixed8 integer as string). */
    gasPerCredit: string;
    creditsForGas: typeof creditsForGas;
    gasForCredits: typeof gasForCredits;
  };
}

// ─── internals ──────────────────────────────────────────────────────────────

const ACTION_RE = /^[\w.:-]{1,64}$/;
const IDEMPOTENCY_KEY_RE = /^[-_a-zA-Z0-9:.]{8,128}$/;
const CONTRACT_HASH_RE = /^0x[0-9a-fA-F]{40}$/;
const HISTORY_LIMIT_DEFAULT = 20;
const HISTORY_LIMIT_MAX = 100;
const BUY_POLL_ATTEMPTS_DEFAULT = 10;
const BUY_POLL_DELAY_MS_DEFAULT = 3_000;
const WAIT_FOR_EVENT_TIMEOUT_MS_DEFAULT = 30_000;
const READ_RETRY_ATTEMPTS_DEFAULT = 3;
const READ_RETRY_BASE_DELAY_MS = 300;
const READ_RETRY_MAX_DELAY_MS = 1_500;

/** Random 32-hex-char suffix for generated idempotency keys. */
function randomKeySuffix(): string {
  const cryptoApi = (globalThis as { crypto?: Crypto }).crypto;
  if (cryptoApi?.getRandomValues) {
    const bytes = new Uint8Array(16);
    cryptoApi.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  }
  // Non-crypto fallback for exotic embeds: uniqueness, not secrecy, is the
  // requirement here (the key only dedupes the caller's own retries).
  let out = "";
  while (out.length < 32) out += Math.floor(Math.random() * 0xffffffff).toString(16);
  return out.slice(0, 32);
}

/** Keep only the ledger's allowed idempotency-key charset. */
function keySafe(value: string): string {
  return value.replace(/[^-_a-zA-Z0-9:.]/g, "-");
}

/**
 * Generated spend idempotency key: `<appId>.<action>.<ts36>.<rand32>`,
 * charset/length-clamped to the ledger's `[-_a-zA-Z0-9:.]{8,128}` contract.
 * The random suffix is always kept intact (the prefix is what gets clamped).
 */
function generateIdempotencyKey(appId: string, action: string): string {
  const prefix = keySafe(`${appId}.${action}`).slice(0, 84);
  return `${prefix}.${Date.now().toString(36)}.${randomKeySuffix()}`;
}

function toHash160(value: string): string {
  const raw = String(value ?? "").trim();
  if (/^(0x)?[0-9a-fA-F]{40}$/.test(raw)) {
    return raw.startsWith("0x") ? raw.toLowerCase() : `0x${raw.toLowerCase()}`;
  }
  const converted = addressToScriptHash(raw);
  if (CONTRACT_HASH_RE.test(converted)) return converted.toLowerCase();
  throw new FrameworkCreditsError(
    "Account must be a valid Neo N3 address or Hash160",
    "ADDRESS_INVALID",
  );
}

function normalizeTxid(value: unknown): string {
  const raw = String(value ?? "").trim().toLowerCase();
  if (!raw) return "";
  return raw.startsWith("0x") ? raw : `0x${raw}`;
}

function asCount(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

interface LedgerErrorBody {
  error?: { code?: unknown; message?: unknown };
}

interface LedgerBalanceBody {
  wallet?: unknown;
  network?: unknown;
  balance?: unknown;
  total_purchased?: unknown;
  total_spent?: unknown;
  total_exited?: unknown;
  updated_at?: unknown;
  events?: unknown[];
}

interface LedgerSpendBody {
  spent?: unknown;
  balance?: unknown;
  event_id?: unknown;
  deduped?: unknown;
}

function decodeEvent(raw: unknown): FrameworkCreditsEvent | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const eventType = String(row.event_type ?? "");
  if (eventType !== "purchase" && eventType !== "spend" && eventType !== "exit") return null;
  return {
    id: asCount(row.id),
    eventType,
    amount: asCount(row.amount),
    balanceAfter: asCount(row.balance_after),
    appId: row.app_id === null || row.app_id === undefined ? null : String(row.app_id),
    action: row.action === null || row.action === undefined ? null : String(row.action),
    idempotencyKey:
      row.idempotency_key === null || row.idempotency_key === undefined
        ? null
        : String(row.idempotency_key),
    txHash: row.tx_hash === null || row.tx_hash === undefined ? null : String(row.tx_hash),
    gasAmount:
      row.gas_amount === null || row.gas_amount === undefined ? null : String(row.gas_amount),
    createdAt: String(row.created_at ?? ""),
  };
}

// ─── factory ────────────────────────────────────────────────────────────────

export function createCreditsSurface(deps: CreditsSurfaceDeps): FrameworkCreditsSurface {
  const { chain } = deps;
  const config = deps.config;

  const isConfigValid = Boolean(
    config &&
      String(config.ledgerUrl ?? "").trim() &&
      CONTRACT_HASH_RE.test(String(config.contractHash ?? "").trim()),
  );

  const requireConfig = (): FrameworkCreditsConfig => {
    if (!config) {
      throw new FrameworkCapabilityError(
        "credits",
        "Credits are not configured on this host — set MiniAppFrameworkOptions.credits " +
          "(ledgerUrl + the network's MiniAppCredits contractHash)",
      );
    }
    if (!String(config.ledgerUrl ?? "").trim()) {
      throw new FrameworkCapabilityError(
        "credits",
        "Credits config is missing ledgerUrl (credits-ledger endpoint URL)",
      );
    }
    if (!CONTRACT_HASH_RE.test(String(config.contractHash ?? "").trim())) {
      throw new FrameworkCapabilityError(
        "credits",
        "Credits config is missing a valid contractHash (0x + 40 hex chars of the deployed MiniAppCredits contract)",
      );
    }
    return config;
  };

  const delay =
    config?.delay ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));

  const resolveNetwork = async (
    override?: FrameworkCreditsNetwork,
  ): Promise<FrameworkCreditsNetwork> => {
    if (override === "mainnet" || override === "testnet") return override;
    if (config?.network === "mainnet" || config?.network === "testnet") return config.network;
    try {
      const detected = String((await chain.detectNetwork()) ?? "").toLowerCase();
      return detected.includes("main") ? "mainnet" : "testnet";
    } catch {
      return "testnet";
    }
  };

  const resolveToken = async (
    resolver: FrameworkCreditsConfig["getAuthToken"],
  ): Promise<string | null> => {
    if (!resolver) return null;
    try {
      const token = await resolver();
      const trimmed = String(token ?? "").trim();
      return trimmed || null;
    } catch {
      return null;
    }
  };

  /**
   * One ledger HTTP round-trip (auth headers + platform error envelope).
   * GETs may retry transient failures (idempotent read); the spend POST runs
   * AT MOST ONCE per call — its idempotency key, not a client retry loop, is
   * the safe-retry mechanism.
   */
  const ledgerRequest = async <T>(
    method: "GET" | "POST",
    url: string,
    body?: Record<string, unknown>,
    retryOnTransient = false,
  ): Promise<T> => {
    const cfg = requireConfig();
    const attempt = async (): Promise<T> => {
      const headers = new Headers();
      if (method !== "GET") headers.set("Content-Type", "application/json");
      headers.set("accept", "application/json");
      const authToken = await resolveToken(cfg.getAuthToken);
      if (authToken) headers.set("Authorization", `Bearer ${authToken}`);
      const apiKey = await resolveToken(cfg.getAPIKey);
      if (apiKey) headers.set("X-API-Key", apiKey);

      const init: RequestInit & { timeoutMs?: number } = {
        method,
        headers,
        credentials: "include",
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      };
      const response = cfg.fetcher
        ? await cfg.fetcher(url, init)
        : await fetchWithTimeout(url, { ...init, timeoutMs: DEFAULT_FETCH_TIMEOUT_MS });

      const text = await response.text();
      let parsed: unknown = {};
      if (text) {
        try {
          parsed = JSON.parse(text);
        } catch {
          parsed = {};
        }
      }
      if (!response.ok) {
        const errorBody = parsed as LedgerErrorBody;
        const code = String(errorBody.error?.code ?? "").trim();
        const message = String(errorBody.error?.message ?? "").trim();
        if (response.status === 429 || response.status >= 500) {
          // Typed as HttpResponseError so the transient classifier can retry.
          throw new HttpResponseError(
            message || `credits-ledger ${method} failed (${response.status})`,
            response.status,
          );
        }
        throw new FrameworkCreditsError(
          message || `credits-ledger ${method} failed (${response.status})`,
          code || "LEDGER_ERROR",
          response.status,
        );
      }
      return parsed as T;
    };
    if (!retryOnTransient) return attempt();
    return retryAsync(attempt, {
      maxAttempts: Math.max(1, config?.readRetryAttempts ?? READ_RETRY_ATTEMPTS_DEFAULT),
      baseDelayMs: READ_RETRY_BASE_DELAY_MS,
      maxDelayMs: READ_RETRY_MAX_DELAY_MS,
      shouldRetry: isTransientFetchError,
    });
  };

  const current = createObservable<FrameworkCreditsBalance | null>(null);

  const decodeBalance = (
    body: LedgerBalanceBody,
    network: string,
  ): FrameworkCreditsBalance => ({
    wallet: String(body.wallet ?? ""),
    network: String(body.network ?? network),
    balance: asCount(body.balance),
    totalPurchased: asCount(body.total_purchased),
    totalSpent: asCount(body.total_spent),
    totalExited: asCount(body.total_exited),
    updatedAt:
      body.updated_at === null || body.updated_at === undefined ? null : String(body.updated_at),
    source: "ledger",
    stale: false,
  });

  /** GET the ledger (balance + newest events), updating `current`. */
  const readLedger = async (
    limit: number,
  ): Promise<{ balance: FrameworkCreditsBalance; events: FrameworkCreditsEvent[] }> => {
    const cfg = requireConfig();
    const network = await resolveNetwork();
    const separator = cfg.ledgerUrl.includes("?") ? "&" : "?";
    const url = `${cfg.ledgerUrl}${separator}network=${encodeURIComponent(network)}&limit=${limit}`;
    const body = await ledgerRequest<LedgerBalanceBody>("GET", url, undefined, true);
    const balance = decodeBalance(body, network);
    current.set(balance);
    const events = Array.isArray(body.events)
      ? body.events.map(decodeEvent).filter((event): event is FrameworkCreditsEvent => event !== null)
      : [];
    return { balance, events };
  };

  /**
   * Ledger-unreachable fallback: the LAST SETTLED on-chain balance
   * (`settledBalanceOf`). Explicitly stale — unsettled purchases/spends
   * since the last settlement epoch are NOT included.
   */
  const chainFallbackBalance = async (network: string): Promise<FrameworkCreditsBalance> => {
    const cfg = requireConfig();
    const wallet = chain.address.get();
    if (!wallet) {
      throw new FrameworkCreditsError(
        "Ledger unreachable and no wallet connected for the settled chain fallback",
        "LEDGER_UNREACHABLE",
      );
    }
    const raw = await chain.read(
      "settledBalanceOf",
      [{ type: "Hash160", value: toHash160(wallet) }],
      { scriptHash: cfg.contractHash },
    );
    let settled = 0n;
    try {
      settled = BigInt(String(raw ?? "0"));
    } catch {
      settled = 0n;
    }
    const fallback: FrameworkCreditsBalance = {
      wallet,
      network,
      balance: Number(settled),
      totalPurchased: 0,
      totalSpent: 0,
      totalExited: 0,
      updatedAt: null,
      source: "chain",
      stale: true,
    };
    current.set(fallback);
    return fallback;
  };

  const balance = async (): Promise<FrameworkCreditsBalance> => {
    requireConfig();
    const network = await resolveNetwork();
    try {
      const { balance: fresh } = await readLedger(1);
      return fresh;
    } catch (ledgerError) {
      try {
        return await chainFallbackBalance(network);
      } catch {
        throw ledgerError;
      }
    }
  };

  // Single-flight per action: a second spend for the SAME action while one is
  // in flight (double-click, double-submit) joins the in-flight promise —
  // exactly one ledger debit is issued. Different actions run concurrently.
  const inFlightSpends = new Map<string, Promise<FrameworkCreditsSpendResult>>();

  const runSpend = async (
    amount: number,
    action: string,
    meta: FrameworkCreditsSpendMeta,
  ): Promise<FrameworkCreditsSpendResult> => {
    const cfg = requireConfig();
    const network = await resolveNetwork(meta.network);
    const appId = String(deps.appId ?? "").trim().toLowerCase();

    let idempotencyKey = String(meta.idempotencyKey ?? "").trim();
    if (idempotencyKey) {
      if (!IDEMPOTENCY_KEY_RE.test(idempotencyKey)) {
        throw new FrameworkCreditsError(
          "idempotencyKey must match [-_a-zA-Z0-9:.]{8,128}",
          "IDEMPOTENCY_KEY_INVALID",
        );
      }
    } else {
      idempotencyKey = generateIdempotencyKey(appId, action);
    }

    const wallet = chain.address.get();
    const body: Record<string, unknown> = {
      network,
      app_id: appId,
      action,
      amount,
      idempotency_key: idempotencyKey,
      ...(wallet ? { wallet } : {}),
    };

    let response: LedgerSpendBody;
    try {
      response = await ledgerRequest<LedgerSpendBody>("POST", cfg.ledgerUrl, body, false);
    } catch (error) {
      if (
        error instanceof FrameworkCreditsError &&
        (error.httpStatus === 402 || error.code === "INSUFFICIENT_CREDITS")
      ) {
        throw new FrameworkInsufficientCreditsError(amount, current.get()?.balance ?? null);
      }
      throw error;
    }

    const result: FrameworkCreditsSpendResult = {
      appId,
      action,
      network,
      spent: asCount(response.spent ?? amount),
      balance: asCount(response.balance),
      eventId:
        response.event_id === null || response.event_id === undefined
          ? null
          : (response.event_id as number | string),
      deduped: Boolean(response.deduped),
      idempotencyKey,
    };

    // Fold the post-spend balance into the observable so UIs tracking
    // `current` stay live without an extra GET; totals refresh on next read.
    const known = current.get();
    if (known) {
      current.set({ ...known, balance: result.balance, source: "ledger", stale: false });
    }
    return result;
  };

  const spend = async (
    amount: number,
    action: string,
    meta: FrameworkCreditsSpendMeta = {},
  ): Promise<FrameworkCreditsSpendResult> => {
    // Guard + validate BEFORE joining/creating a flight (`async` so denials
    // reject, matching every other framework write lane) — bad calls never
    // coalesce onto a healthy in-flight spend. No `await` happens before the
    // single-flight join below, so concurrent same-action calls still dedupe
    // deterministically.
    deps.assertNotGuest();
    requireConfig();
    if (!Number.isInteger(amount) || amount <= 0) {
      throw new FrameworkCreditsError(
        "spend amount must be a positive integer credit count",
        "AMOUNT_INVALID",
      );
    }
    const actionKey = String(action ?? "").trim();
    if (!ACTION_RE.test(actionKey)) {
      throw new FrameworkCreditsError(
        "spend action must match [\\w.:-]{1,64}",
        "ACTION_INVALID",
      );
    }
    const existing = inFlightSpends.get(actionKey);
    if (existing) return existing;
    const flight = runSpend(amount, actionKey, meta).finally(() => {
      inFlightSpends.delete(actionKey);
    });
    inFlightSpends.set(actionKey, flight);
    return flight;
  };

  const buy = async (gasAmount: bigint | number | string): Promise<FrameworkCreditsBuyResult> => {
    deps.assertNotGuest();
    // S11: buying credits is the on-chain payment lane — the manifest
    // "payments" permission gates it. Spends are off-chain and stay ungated.
    deps.requireBuyPermission();
    const cfg = requireConfig();

    const fixed8 = gasAmountToFixed8(gasAmount);
    const credits = fixed8 / GAS_BASE_UNITS_PER_CREDIT;
    if (credits < 1n) {
      throw new FrameworkCreditsError(
        `GAS amount below the 1-credit minimum (${gasForCredits(1n)} GAS) — the contract rejects dust`,
        "BUY_BELOW_MINIMUM",
      );
    }

    const from = chain.address.get() || (await chain.ensureWallet());
    const contractHash = String(cfg.contractHash).trim().toLowerCase();
    const tx = await chain.invoke(
      "transfer",
      [
        { type: "Hash160", value: toHash160(from) },
        { type: "Hash160", value: contractHash },
        { type: "Integer", value: fixed8.toString() },
        { type: "String", value: CREDITS_BUY_MEMO },
      ],
      { scriptHash: (cfg.gasTokenHash ?? GAS_TOKEN_HASH).toLowerCase() },
    );
    const txid = normalizeTxid(tx.txid);

    // Best-effort on-chain confirmation: the host event lane may not index
    // the credits contract, so a miss here is NOT a failure.
    let event: unknown | null = null;
    if (chain.waitForEvent) {
      try {
        event = await chain.waitForEvent(
          tx.txid,
          "CreditsPurchased",
          cfg.waitForEventTimeoutMs ?? WAIT_FOR_EVENT_TIMEOUT_MS_DEFAULT,
        );
      } catch {
        event = null;
      }
    }

    // Bounded ledger poll: resolve `credited` once the indexer wrote the
    // purchase event for this txid. Never throws — the GAS is already sent,
    // so an indexer lag/outage must not surface as a failed buy.
    const attempts = Math.max(1, cfg.buyPollAttempts ?? BUY_POLL_ATTEMPTS_DEFAULT);
    const pollDelayMs = cfg.buyPollDelayMs ?? BUY_POLL_DELAY_MS_DEFAULT;
    let credited = false;
    let latest: FrameworkCreditsBalance | null = null;
    for (let attempt = 0; attempt < attempts && !credited; attempt += 1) {
      await delay(pollDelayMs);
      try {
        const { balance: fresh, events } = await readLedger(HISTORY_LIMIT_DEFAULT);
        latest = fresh;
        credited = events.some(
          (row) => row.eventType === "purchase" && normalizeTxid(row.txHash) === txid,
        );
      } catch {
        /* ledger blip — keep polling within the budget */
      }
    }

    return {
      txid: tx.txid,
      gasFixed8: fixed8.toString(),
      credits: Number(credits),
      credited,
      balance: latest,
      event,
    };
  };

  const canAfford = async (amount: number): Promise<boolean> => {
    if (!Number.isInteger(amount) || amount <= 0) return false;
    const known = current.get();
    const snapshot = known ?? (await balance());
    return snapshot.balance >= amount;
  };

  const history = async (limit = HISTORY_LIMIT_DEFAULT): Promise<FrameworkCreditsEvent[]> => {
    requireConfig();
    const clamped = Math.min(Math.max(Math.trunc(limit) || HISTORY_LIMIT_DEFAULT, 1), HISTORY_LIMIT_MAX);
    const { events } = await readLedger(clamped);
    return events;
  };

  return {
    get available(): boolean {
      return isConfigValid;
    },
    current,
    balance,
    refresh: balance,
    buy,
    spend,
    canAfford,
    history,
    rate: {
      creditsPerGas: Number(CREDITS_PER_GAS),
      gasPerCredit: GAS_BASE_UNITS_PER_CREDIT.toString(),
      creditsForGas,
      gasForCredits,
    },
  };
}
