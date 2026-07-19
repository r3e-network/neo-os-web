/**
 * framework/chain-pending — RFC P1-4 pending-tx durability lane
 * (`chain.pending`) plus the canonical `chain.readTxOutcome`
 * getapplicationlog reader.
 *
 * Kills two hand-rolled fleets:
 * - the 17-app `PENDING_STORAGE_KEY` persist→poll→restore blocks
 *   (dice-game/src/main.tsx `restorePendingBets`, gas-sponsor's
 *   persistPending read-back verification): `track` persists a
 *   versioned record under a framework-owned storage key, polls with a
 *   bounded budget, and `restore` re-arms the lane after a reload.
 * - the 28-app private `getapplicationlog` copies (daily-checkin-safety's
 *   readDailyCheckinTransactionOutcome, red-envelope-rpc's
 *   readRedEnvelopeExecutionState, aa-relay-console's log+raw-tx pair):
 *   `readTxOutcome` returns one `{ state, notifications, blockIndex,
 *   validUntilBlock }` verdict and NEVER throws — every failure mode
 *   (malformed txid, unknown network, RPC error, node lag) collapses to
 *   the poll-safe `"pending"` state.
 *
 * Notification decode absorbs the daily-checkin semantics verbatim:
 * contract hashes normalized through {@link normalizeAccount}, state slots
 * decoded via utils/neo `parseStackItem` and wrapped as `{ value }` so the
 * existing chain-events helpers (`chain.eventValue`, `events.value`) read
 * them directly, and {@link findNotification} matches contracts through
 * {@link accountMatches} (display hex, chain-order hex and N3 address
 * variants all compare equal).
 *
 * The poll engine follows lifecycle.poll's approach: an interval loop
 * with an immediate first tick, `document.hidden` visibility pausing
 * (resuming with an immediate catch-up tick), and swallowed tick errors
 * so one RPC hiccup never kills a lane. Pollers self-terminate on settle
 * or TTL expiry; when the host passes `registerCleanup`
 * (lifecycle.cleanup), every live poller is also stopped on unmount.
 *
 * Standalone module — framework/index.ts + types.ts wiring happens in a
 * separate integration pass.
 */

import { fetchWithTimeout } from "./utils/fetch-timeout";
import { addressToScriptHash, parseHash160, parseStackItem } from "./utils/neo";
import type { FrameworkLocalStorageSurface } from "./types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Version tag of the persisted lane envelope (bump on layout change). */
export const PENDING_STORAGE_VERSION = 1;

/**
 * Framework-owned storage key prefix. The injected storage lane is already
 * app-namespaced (`neo:<appId>:`), so lanes never collide across apps.
 */
export const PENDING_STORAGE_PREFIX = "chain.pending:";

/** Default poll cadence — events.ts waitFor / daily-checkin parity (2.5–5s). */
export const DEFAULT_PENDING_POLL_MS = 5_000;

/**
 * Default per-entry poll budget: 15 minutes ≈ 60 Neo N3 blocks. A write
 * that has not produced an observable effect by then is treated as expired
 * (`onExpired`) instead of polling forever.
 */
export const DEFAULT_PENDING_TTL_MS = 900_000;

/** Per-RPC-call deadline for outcome reads (daily-checkin parity). */
export const OUTCOME_RPC_TIMEOUT_MS = 8_000;

const TXID_RE = /^0x[0-9a-f]{64}$/;
const HASH160_RE = /^0x[0-9a-fA-F]{40}$/;
const ZERO_HASH160_RE = /^0x0{40}$/i;

/**
 * Separator between lane and txid in the in-memory poller map. A NUL can
 * never appear inside a normalized txid, so keys are collision-free.
 */
const ACTIVE_KEY_SEP = "\u0000";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** One persisted pending transaction (RFC P1-4). */
export interface FrameworkPendingTx<TMeta = unknown> {
  /** Normalized lowercase `0x`-prefixed transaction id. */
  txid: string;
  /** App-owned payload persisted alongside the txid (must be JSON-safe). */
  meta: TMeta;
  /** Epoch milliseconds when the entry was tracked. */
  createdAt: number;
}

/** App-supplied settle/expiry callbacks for a tracked lane (RFC P1-4). */
export interface FrameworkPendingHandlers<TMeta = unknown> {
  /** Poll predicate — true once the tx's effect is observable (event/state). */
  isSettled(entry: FrameworkPendingTx<TMeta>): Promise<boolean>;
  /** Runs once when `isSettled` first passes; the entry is already cleared. */
  onSettled(entry: FrameworkPendingTx<TMeta>): void | Promise<void>;
  /** Runs once when the poll budget expires unsettled; entry already cleared. */
  onExpired?(entry: FrameworkPendingTx<TMeta>): void | Promise<void>;
}

/** Per-lane poll tuning for track/restore. */
export interface FrameworkPendingPollOptions {
  /** Poll cadence in ms (default {@link DEFAULT_PENDING_POLL_MS}). */
  pollMs?: number;
  /** Settle-poll budget in ms (default {@link DEFAULT_PENDING_TTL_MS}). */
  ttlMs?: number;
}

/** Terminal/pending VM verdict of {@link FrameworkTxOutcome}. */
export type FrameworkTxOutcomeState = "halt" | "fault" | "pending";

/**
 * One decoded contract notification. `state` slots are positional and read
 * directly with the chain-events helpers (`eventValue(notification, i)`).
 */
export interface FrameworkTxNotification {
  /** Emitting contract, normalized display-order `0x` hash160. */
  contract: string;
  /** Event name (`eventname` on the wire; `event_name` tolerated). */
  eventName: string;
  /** Decoded positional state slots (utils/neo `parseStackItem` values). */
  state: Array<{ value: unknown }>;
}

/**
 * The canonical post-broadcast verdict. `blockIndex`/`validUntilBlock`
 * come from `getrawtransaction` (aa-relay-console semantics) and are null
 * while the tx record is unavailable.
 */
export interface FrameworkTxOutcome {
  /** `"pending"` covers every non-terminal answer, including unreachable. */
  state: FrameworkTxOutcomeState;
  /** Decoded notifications; empty unless `state === "halt"`. */
  notifications: FrameworkTxNotification[];
  /** Block the tx was mined in, when the node reports it. */
  blockIndex: number | null;
  /** The tx's own valid-until block height, when the node reports it. */
  validUntilBlock: number | null;
}

/** Per-call overrides for {@link FrameworkChainPendingSurface.readTxOutcome}. */
export interface FrameworkTxOutcomeOptions {
  /** Pin the network instead of resolving the host's current one. */
  network?: string;
  /** Per-RPC-call deadline in ms (default {@link OUTCOME_RPC_TIMEOUT_MS}). */
  timeoutMs?: number;
}

/** Dependencies injected into {@link createChainPendingSurface}. */
export interface FrameworkChainPendingDeps {
  /** The `app.storage.local` lane (already app-namespaced). */
  storage: FrameworkLocalStorageSurface;
  /**
   * Resolve the JSON-RPC endpoint for a network label
   * (e.g. apps/shared `getRpcUrl`); return "" to treat reads as pending.
   */
  rpcUrl(network: string): string;
  /** Current network label (e.g. `chain.detectNetwork` + launch fallback). */
  network(): string | Promise<string>;
  /** Test/host transport override; defaults to fetchWithTimeout(fetch). */
  fetcher?: typeof fetch;
  /**
   * Optional host cleanup registrar (lifecycle.cleanup) — when present,
   * every live poller is stopped on miniapp unmount.
   */
  registerCleanup?: (fn: () => void) => void;
}

// ---------------------------------------------------------------------------
// Account helpers (daily-checkin semantics, generalized)
// ---------------------------------------------------------------------------

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function isDisplayHash160(value: string): boolean {
  return HASH160_RE.test(value) && !ZERO_HASH160_RE.test(value);
}

/** Byte-reverse a display-order `0x` hash160 into chain order ("" when n/a). */
function reverseHash160(value: string): string {
  const bytes = value.replace(/^0x/i, "").match(/../g) ?? [];
  return bytes.length === 20 ? `0x${[...bytes].reverse().join("")}`.toLowerCase() : "";
}

/**
 * Normalize a Neo account value (N3 address, display-order `0x` hash160, or
 * any chain-read shape parseHash160 accepts) to the canonical lowercase
 * display-order `0x` form. The zero hash and unparseable input normalize to
 * "" so they can never false-positive a match.
 */
export function normalizeAccount(value: unknown): string {
  const raw = clean(value);
  if (isDisplayHash160(raw)) return raw.toLowerCase();
  const fromAddress = addressToScriptHash(raw);
  if (isDisplayHash160(fromAddress)) return fromAddress.toLowerCase();
  const parsed = parseHash160(value);
  return isDisplayHash160(parsed) ? parsed.toLowerCase() : "";
}

/**
 * Compare two account values across every representation a chain read can
 * produce: normalized display hex, raw hex, byte-reversed (chain-order) hex
 * and N3 address. Empty/zero inputs never match.
 */
export function accountMatches(value: unknown, expected: unknown): boolean {
  const variants = (candidate: unknown): Set<string> => {
    const values = new Set<string>();
    const normalized = normalizeAccount(candidate);
    if (normalized) values.add(normalized);
    const raw = clean(candidate);
    if (isDisplayHash160(raw)) {
      values.add(raw.toLowerCase());
      values.add(reverseHash160(raw));
    }
    const parsed = parseHash160(candidate);
    if (isDisplayHash160(parsed)) values.add(parsed.toLowerCase());
    values.delete("");
    return values;
  };
  const left = variants(value);
  const right = variants(expected);
  return left.size > 0 && right.size > 0 && [...left].some((entry) => right.has(entry));
}

/**
 * Find a notification by emitting contract + event name, optionally refined
 * by `predicate` (daily-checkin's findDailyCheckinNotification semantics).
 * The contract may be given in any form {@link accountMatches} accepts.
 */
export function findNotification(
  outcome: FrameworkTxOutcome,
  contract: string,
  eventName: string,
  predicate?: (notification: FrameworkTxNotification) => boolean,
): FrameworkTxNotification | null {
  return (
    outcome.notifications.find(
      (notification) =>
        notification.eventName === eventName &&
        accountMatches(notification.contract, contract) &&
        (!predicate || predicate(notification)),
    ) ?? null
  );
}

// ---------------------------------------------------------------------------
// Shared normalizers
// ---------------------------------------------------------------------------

/** Normalize a tx id for reads/keys: trim, lowercase, 0x-prefix; "" if bad. */
function normalizeTxid(value: unknown): string {
  const raw = clean(value).toLowerCase();
  const normalized = raw.startsWith("0x") ? raw : raw ? `0x${raw}` : "";
  return TXID_RE.test(normalized) ? normalized : "";
}

/** Accept a bare state array or the `{ state: { value: [...] } }` envelope. */
function stateArrayOf(notification: unknown): unknown[] | null {
  if (!notification || typeof notification !== "object") return null;
  const state = (notification as { state?: unknown }).state;
  if (Array.isArray(state)) return state;
  if (state && typeof state === "object" && "value" in state) {
    const value = (state as { value?: unknown }).value;
    return Array.isArray(value) ? value : null;
  }
  return null;
}

/** Decode one raw RPC notification; null when any required field is absent. */
function parseNotification(notification: unknown): FrameworkTxNotification | null {
  if (!notification || typeof notification !== "object") return null;
  const record = notification as {
    contract?: unknown;
    eventname?: unknown;
    event_name?: unknown;
  };
  const contract = normalizeAccount(record.contract);
  const eventName = clean(record.eventname ?? record.event_name);
  const state = stateArrayOf(notification);
  if (!contract || !eventName || !state) return null;
  return {
    contract,
    eventName,
    state: state.map((entry) => ({ value: parseStackItem(entry) })),
  };
}

// ---------------------------------------------------------------------------
// RPC wire shapes
// ---------------------------------------------------------------------------

interface RpcExecution {
  vmstate?: unknown;
  notifications?: unknown;
}

interface ApplicationLogResult {
  executions?: RpcExecution[];
}

interface RawTransactionResult {
  blockindex?: unknown;
  block_index?: unknown;
  validuntilblock?: unknown;
  valid_until_block?: unknown;
}

interface RpcEnvelope<T> {
  result?: T;
  error?: unknown;
}

/** A non-negative block height, or null for absent/garbage fields. */
function blockHeight(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}

// ---------------------------------------------------------------------------
// Pending-tx persistence
// ---------------------------------------------------------------------------

type PendingEnvelope = {
  version: typeof PENDING_STORAGE_VERSION;
  entries: Array<FrameworkPendingTx<unknown>>;
};

/**
 * Validate one persisted entry. Only the txid shape and a finite positive
 * createdAt are load-bearing; `meta` is app-opaque (and may legitimately be
 * absent — JSON serialization drops an `undefined` meta).
 */
function isPendingEntry(value: unknown): value is FrameworkPendingTx<unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const entry = value as Partial<FrameworkPendingTx<unknown>>;
  return (
    typeof entry.txid === "string" &&
    TXID_RE.test(entry.txid) &&
    Number.isFinite(entry.createdAt) &&
    Number(entry.createdAt) > 0
  );
}

// ---------------------------------------------------------------------------
// Surface
// ---------------------------------------------------------------------------

/** The `chain.pending` + `chain.readTxOutcome` surface. */
export interface FrameworkChainPendingSurface {
  /**
   * Persist a pending tx under `lane` and start polling for its effect.
   * Returns the stored record, or null for a malformed lane/txid (nothing
   * is persisted or polled in that case). Re-tracking the same txid
   * replaces the record and restarts its poller with the new handlers.
   */
  track<TMeta>(
    lane: string,
    entry: { txid: string; meta: TMeta },
    handlers: FrameworkPendingHandlers<TMeta>,
    options?: FrameworkPendingPollOptions,
  ): FrameworkPendingTx<TMeta> | null;
  /**
   * Re-arm persisted entries of `lane` after a reload; resolves with the
   * number of entries restored (already-active txids are skipped).
   */
  restore<TMeta>(
    lane: string,
    handlers: FrameworkPendingHandlers<TMeta>,
    options?: FrameworkPendingPollOptions,
  ): Promise<number>;
  /** Every persisted entry of `lane` (storage is the source of truth). */
  list(lane: string): FrameworkPendingTx[];
  /** Stop polling and forget one txid — or the whole lane when omitted. */
  clear(lane: string, txid?: string): void;
  /**
   * Canonical post-broadcast verdict (see {@link FrameworkTxOutcome}).
   * Never throws: malformed input, unknown networks, RPC errors and node
   * lag all resolve to the `"pending"` state so poll loops can retry.
   */
  readTxOutcome(txid: string, options?: FrameworkTxOutcomeOptions): Promise<FrameworkTxOutcome>;
  /** Surface alias of {@link normalizeAccount}. */
  normalizeAccount(value: unknown): string;
  /** Surface alias of {@link accountMatches}. */
  accountMatches(value: unknown, expected: unknown): boolean;
  /** Surface alias of {@link findNotification}. */
  findNotification(
    outcome: FrameworkTxOutcome,
    contract: string,
    eventName: string,
    predicate?: (notification: FrameworkTxNotification) => boolean,
  ): FrameworkTxNotification | null;
}

function normalizeLane(value: unknown): string {
  return clean(value);
}

/**
 * Build the `chain.pending` / `chain.readTxOutcome` surface. See the module
 * doc for the absorbed semantics; see {@link FrameworkChainPendingDeps} for
 * the host wiring contract.
 *
 * @example
 * ```ts
 * const pending = createChainPendingSurface({
 *   storage: storageSurface.local,
 *   rpcUrl: (network) => getRpcUrl(network),
 *   network: () => chainSurface.detectNetwork(),
 * });
 * pending.track("bets", { txid, meta: { betId } }, {
 *   isSettled: async (entry) =>
 *     (await pending.readTxOutcome(entry.txid)).state === "halt",
 *   onSettled: (entry) => credit(entry.meta.betId),
 * });
 * ```
 */
export function createChainPendingSurface(
  deps: FrameworkChainPendingDeps,
): FrameworkChainPendingSurface {
  const { storage } = deps;

  const laneKey = (lane: string): string => `${PENDING_STORAGE_PREFIX}${lane}`;
  const activeKey = (lane: string, txid: string): string =>
    `${lane}${ACTIVE_KEY_SEP}${txid}`;

  /** Live poller stop functions, keyed by {@link activeKey}. */
  const active = new Map<string, () => void>();
  let cleanupRegistered = false;

  // ── persistence ──────────────────────────────────────────────────────────

  const writeLane = (lane: string, entries: Array<FrameworkPendingTx<unknown>>): void => {
    if (entries.length === 0) {
      storage.delete(laneKey(lane));
      return;
    }
    const envelope: PendingEnvelope = { version: PENDING_STORAGE_VERSION, entries };
    storage.set(laneKey(lane), envelope);
  };

  const readLane = (lane: string): Array<FrameworkPendingTx<unknown>> => {
    const raw = storage.get<unknown>(laneKey(lane), null);
    if (raw === null || raw === undefined) return [];
    if (
      !raw ||
      typeof raw !== "object" ||
      Array.isArray(raw) ||
      (raw as { version?: unknown }).version !== PENDING_STORAGE_VERSION ||
      !Array.isArray((raw as { entries?: unknown }).entries)
    ) {
      // Malformed envelope (hand-edited storage, older layout): drop it —
      // the gas-sponsor semantics, never keep an unparseable recovery record.
      storage.delete(laneKey(lane));
      return [];
    }
    const envelope = raw as PendingEnvelope;
    const entries = envelope.entries.filter(isPendingEntry);
    if (entries.length !== envelope.entries.length) {
      // Some entries rotted (bad txid/createdAt): persist the cleaned list
      // so the store converges instead of re-dropping them on every read.
      writeLane(lane, entries);
    }
    return entries;
  };

  const removeEntry = (lane: string, txid: string): void => {
    writeLane(
      lane,
      readLane(lane).filter((entry) => entry.txid !== txid),
    );
  };

  // ── poll engine (lifecycle.poll approach) ────────────────────────────────

  const ensureCleanupRegistered = (): void => {
    if (cleanupRegistered) return;
    cleanupRegistered = true;
    deps.registerCleanup?.(() => {
      for (const stop of [...active.values()]) stop();
    });
  };

  const stopPoller = (lane: string, txid: string): void => {
    const key = activeKey(lane, txid);
    active.get(key)?.();
    active.delete(key);
  };

  const startPoller = <TMeta>(
    lane: string,
    entry: FrameworkPendingTx<TMeta>,
    handlers: FrameworkPendingHandlers<TMeta>,
    options: FrameworkPendingPollOptions,
  ): void => {
    ensureCleanupRegistered();
    const pollMs =
      Number.isFinite(options.pollMs) && Number(options.pollMs) > 0
        ? Number(options.pollMs)
        : DEFAULT_PENDING_POLL_MS;
    const ttlMs =
      Number.isFinite(options.ttlMs) && Number(options.ttlMs) > 0
        ? Number(options.ttlMs)
        : DEFAULT_PENDING_TTL_MS;
    const expiresAt = entry.createdAt + ttlMs;
    const key = activeKey(lane, entry.txid);

    let stopped = false;
    let inTick = false;
    let timer: ReturnType<typeof setInterval> | null = null;
    let removeVisibilityListener: (() => void) | null = null;

    const pause = (): void => {
      if (timer === null) return;
      clearInterval(timer);
      timer = null;
    };

    const stop = (): void => {
      if (stopped) return;
      stopped = true;
      pause();
      removeVisibilityListener?.();
      removeVisibilityListener = null;
      active.delete(key);
    };

    const finish = (kind: "settled" | "expired"): void => {
      stop();
      removeEntry(lane, entry.txid);
      // Handler errors must never break the lane (EventBus/lifecycle rule).
      try {
        const result =
          kind === "settled" ? handlers.onSettled(entry) : handlers.onExpired?.(entry);
        if (result && typeof (result as Promise<unknown>).catch === "function") {
          (result as Promise<unknown>).catch(() => {});
        }
      } catch {
        /* keep the lane alive after a throwing handler */
      }
    };

    const tick = async (): Promise<void> => {
      if (stopped || inTick) return;
      inTick = true;
      try {
        let settled = false;
        try {
          settled = await handlers.isSettled(entry);
        } catch {
          settled = false; // RPC hiccup — keep polling within the budget.
        }
        if (stopped) return;
        // Settle wins over expiry: the budget bounds POLLING, not outcome
        // detection — a tx that landed while the app was closed still
        // reports settled on restore even past its TTL.
        if (settled) {
          finish("settled");
          return;
        }
        if (Date.now() >= expiresAt) finish("expired");
      } finally {
        inTick = false;
      }
    };

    const start = (runNow: boolean): void => {
      if (stopped || timer !== null) return;
      timer = setInterval(() => {
        void tick();
      }, pollMs);
      if (runNow) void tick();
    };

    const hasDocument = typeof document !== "undefined";
    if (hasDocument) {
      const onVisibilityChange = (): void => {
        if (document.hidden) pause();
        else start(true);
      };
      document.addEventListener("visibilitychange", onVisibilityChange);
      removeVisibilityListener = () =>
        document.removeEventListener("visibilitychange", onVisibilityChange);
    }

    // Registered BEFORE the first tick so a synchronously-finishing tick
    // (a sync-throwing isSettled on an already-expired entry) can never
    // leave a zombie stop function behind in the map.
    active.set(key, stop);
    const startHidden = hasDocument && document.hidden;
    if (!startHidden) start(true);
  };

  // ── readTxOutcome ────────────────────────────────────────────────────────

  const pendingOutcome = (): FrameworkTxOutcome => ({
    state: "pending",
    notifications: [],
    blockIndex: null,
    validUntilBlock: null,
  });

  const rpcCall = async <T>(
    url: string,
    method: string,
    params: unknown[],
    timeoutMs: number,
  ): Promise<T | null> => {
    const init: RequestInit = {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      cache: "no-store",
    };
    const response = deps.fetcher
      ? await deps.fetcher(url, init)
      : await fetchWithTimeout(url, { ...init, timeoutMs });
    if (!response.ok) return null;
    const payload = (await response.json()) as RpcEnvelope<T>;
    if (payload.error) return null;
    return payload.result ?? null;
  };

  const readTxOutcome = async (
    txidInput: string,
    options: FrameworkTxOutcomeOptions = {},
  ): Promise<FrameworkTxOutcome> => {
    const txid = normalizeTxid(txidInput);
    if (!txid) return pendingOutcome();
    try {
      const network = options.network ?? (await deps.network());
      const url = deps.rpcUrl(clean(network));
      if (!url) return pendingOutcome();
      const timeoutMs =
        Number.isFinite(options.timeoutMs) && Number(options.timeoutMs) > 0
          ? Number(options.timeoutMs)
          : OUTCOME_RPC_TIMEOUT_MS;
      // aa-relay-console semantics: log + raw-tx read as a pair — either
      // side missing (not yet executed, not yet visible) means pending.
      const [log, tx] = await Promise.all([
        rpcCall<ApplicationLogResult>(url, "getapplicationlog", [txid], timeoutMs),
        rpcCall<RawTransactionResult>(url, "getrawtransaction", [txid, true], timeoutMs),
      ]);
      if (!log || !tx) return pendingOutcome();
      const executions = Array.isArray(log.executions) ? log.executions : [];
      const states = executions
        .map((execution) => clean(execution?.vmstate).toUpperCase())
        .filter(Boolean);
      const blockIndex = blockHeight(tx.blockindex ?? tx.block_index);
      const validUntilBlock = blockHeight(tx.validuntilblock ?? tx.valid_until_block);
      if (states.some((state) => state.includes("FAULT"))) {
        return { state: "fault", notifications: [], blockIndex, validUntilBlock };
      }
      if (!(states.length > 0 && states.every((state) => state.includes("HALT")))) {
        return { state: "pending", notifications: [], blockIndex, validUntilBlock };
      }
      const notifications = executions
        .flatMap((execution) =>
          Array.isArray(execution?.notifications) ? execution.notifications : [],
        )
        .map(parseNotification)
        .filter((entry): entry is FrameworkTxNotification => entry !== null);
      return { state: "halt", notifications, blockIndex, validUntilBlock };
    } catch {
      return pendingOutcome();
    }
  };

  // ── surface ──────────────────────────────────────────────────────────────

  return {
    track<TMeta>(
      lane: string,
      entry: { txid: string; meta: TMeta },
      handlers: FrameworkPendingHandlers<TMeta>,
      options: FrameworkPendingPollOptions = {},
    ): FrameworkPendingTx<TMeta> | null {
      const normalizedLane = normalizeLane(lane);
      if (!normalizedLane || !entry || typeof entry !== "object") return null;
      const txid = normalizeTxid(entry.txid);
      if (!txid) return null;
      const record: FrameworkPendingTx<TMeta> = {
        txid,
        meta: entry.meta,
        createdAt: Date.now(),
      };
      // Re-tracking replaces: stop the old poller and overwrite the record
      // so the latest handlers/meta own the lane.
      stopPoller(normalizedLane, txid);
      const entries = readLane(normalizedLane).filter((stored) => stored.txid !== txid);
      entries.push(record as FrameworkPendingTx<unknown>);
      writeLane(normalizedLane, entries);
      startPoller(normalizedLane, record, handlers, options);
      return record;
    },

    async restore<TMeta>(
      lane: string,
      handlers: FrameworkPendingHandlers<TMeta>,
      options: FrameworkPendingPollOptions = {},
    ): Promise<number> {
      const normalizedLane = normalizeLane(lane);
      if (!normalizedLane) return 0;
      let restored = 0;
      for (const entry of readLane(normalizedLane)) {
        if (active.has(activeKey(normalizedLane, entry.txid))) continue;
        startPoller(
          normalizedLane,
          entry as FrameworkPendingTx<TMeta>,
          handlers,
          options,
        );
        restored += 1;
      }
      return restored;
    },

    list(lane: string): FrameworkPendingTx[] {
      const normalizedLane = normalizeLane(lane);
      return normalizedLane ? readLane(normalizedLane) : [];
    },

    clear(lane: string, txid?: string): void {
      const normalizedLane = normalizeLane(lane);
      if (!normalizedLane) return;
      if (txid === undefined) {
        // Stop every live poller of the lane (even one whose persist write
        // was swallowed by an unavailable storage backend), then drop the key.
        const prefix = `${normalizedLane}${ACTIVE_KEY_SEP}`;
        for (const key of [...active.keys()]) {
          if (key.startsWith(prefix)) active.get(key)?.();
        }
        storage.delete(laneKey(normalizedLane));
        return;
      }
      const normalizedTxid = normalizeTxid(txid);
      if (!normalizedTxid) return;
      stopPoller(normalizedLane, normalizedTxid);
      removeEntry(normalizedLane, normalizedTxid);
    },

    readTxOutcome,

    normalizeAccount(value: unknown): string {
      return normalizeAccount(value);
    },

    accountMatches(value: unknown, expected: unknown): boolean {
      return accountMatches(value, expected);
    },

    findNotification(
      outcome: FrameworkTxOutcome,
      contract: string,
      eventName: string,
      predicate?: (notification: FrameworkTxNotification) => boolean,
    ): FrameworkTxNotification | null {
      return findNotification(outcome, contract, eventName, predicate);
    },
  };
}
