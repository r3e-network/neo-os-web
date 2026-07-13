/**
 * app.events + app.bus — S4 of the framework-extraction plan (§2, Wave 1).
 *
 * `createEventsSurface` wraps the injected chain service's event methods
 * (ChainService.listEvents / listAllEvents / listEventsParsed / waitForEvent)
 * behind the framework surface, degrading gracefully when the host injects a
 * minimal chain slice (standalone/OneGate): `listAll` falls back to paging
 * `listEvents` with the useAllEvents full-page continuation heuristic,
 * `listParsed` maps + null-filters locally, and `waitFor` falls back to a
 * client-side txid-matching poll mirroring the wallet-sdk waitForEvent
 * cadence. `value`/`record` are the canonical positional slot decode that
 * retires the per-app `eventValue`/`eventSlot` copies (daily-checkin
 * useCheckin.ts, unbreakable-vault useVaultCreator.ts/useVaultBreaker.ts).
 *
 * `createBusSurface` is the app-facing pub/sub (on/once/emit/off). It
 * delegates to the injected platform EventBus when present so migrated apps
 * keep receiving cross-service channels (TRANSACTION_CONFIRMED,
 * BALANCE_CHANGED, ...), and degrades to a private in-app bus with identical
 * semantics when absent. When a lifecycle service is injected, every on/once
 * subscription is automatically released on miniapp unmount.
 *
 * Standalone module — framework/index.ts wiring happens in a separate
 * integration pass.
 */

import { eventValue } from "./utils/chain-events";

// ---------------------------------------------------------------------------
// Constants (mirroring the shared-service semantics this module retires)
// ---------------------------------------------------------------------------

/**
 * Default wait for a transaction's confirming event: ~2 Neo N3 blocks
 * (~15s each) plus indexer lag. Mirrors ChainService.EVENT_WAIT_TIMEOUT_MS so
 * the surface default matches the service default byte-for-byte.
 */
const EVENT_WAIT_TIMEOUT_MS = 45_000;

/**
 * Poll cadence of the `waitFor` fallback — mirrors the wallet-sdk
 * useEvents().waitForEvent 2.5s sleep between list polls.
 */
const EVENT_WAIT_POLL_MS = 2_500;

/**
 * How many recent events one fallback `waitFor` poll scans for the target
 * txid. The wallet-sdk path filters by tx_hash server-side (limit 1); the
 * client-side fallback needs a window of recent events instead.
 */
const EVENT_WAIT_SCAN_LIMIT = 50;

/** Page size of the `listAll` fallback pagination — useAllEvents default. */
const EVENT_PAGE_SIZE = 50;

/**
 * Default `listAll` bound. Matches the defensive cap the count-then-page
 * apps hand-roll so an unbounded indexer walk can never balloon a
 * recovery scan.
 */
const DEFAULT_LIST_ALL_CAP = 500;

// ---------------------------------------------------------------------------
// app.events
// ---------------------------------------------------------------------------

/**
 * The chain-service slice `app.events` needs. In the platform host this is
 * `ctx.services.chain` (an apps/shared ChainService, which provides all four
 * methods); minimal hosts may inject only `listEvents` — every other method
 * then runs on the documented fallback, and with no method at all the
 * surface degrades to empty results / null.
 */
export interface FrameworkEventsChain {
  /**
   * ChainService.listEvents — one page of events by name, newest first.
   * Defaults (limit 50, offset 0) are applied by the service.
   */
  listEvents?(
    eventName: string,
    options?: { limit?: number; offset?: number },
  ): Promise<unknown[]>;
  /** ChainService.listAllEvents — every matching event across all pages. */
  listAllEvents?(eventName: string): Promise<unknown[]>;
  /**
   * ChainService.listEventsParsed — map every event through `transform`,
   * dropping events for which it returns `null`.
   */
  listEventsParsed?<T>(
    eventName: string,
    transform: (evt: unknown) => T | null,
  ): Promise<T[]>;
  /**
   * ChainService.waitForEvent — poll for the event confirming `txid`;
   * resolves the event payload, or null on timeout (never throws on timeout).
   */
  waitForEvent?(txid: string, eventName: string, timeoutMs?: number): Promise<unknown>;
}

/** Dependencies injected into {@link createEventsSurface}. */
export interface FrameworkEventsDeps {
  /** Injected chain-service slice (`ctx.services.chain` in the platform host). */
  chain: FrameworkEventsChain;
  /**
   * The miniapp id the event stream is scoped to. The ChainService slice
   * already binds it internally (every listEvents/waitForEvent call it makes
   * carries `app_id`), so the surface does not thread it per-call; it is part
   * of the S4 deps contract so the integration pass hands every events
   * surface the same `{ chain, appId }` shape regardless of host.
   */
  appId: string;
}

/** The `app.events` object returned by {@link createEventsSurface}. */
export interface FrameworkEventsSurface {
  /** One page of events by name (pagination passthrough to the service). */
  list(eventName: string, options?: { limit?: number; offset?: number }): Promise<unknown[]>;
  /**
   * Every matching event, bounded by `cap` (default 500) so recovery walks
   * cannot balloon. Delegates to ChainService.listAllEvents when available,
   * otherwise pages `listEvents` with the useAllEvents continuation
   * heuristic (a short page ends the walk).
   */
  listAll(eventName: string, options?: { cap?: number }): Promise<unknown[]>;
  /**
   * Decode events with `decode`, dropping events it maps to `null`
   * (ChainService.listEventsParsed semantics). With `limit` the scan is a
   * single page of at most `limit` events; without it the full (capped)
   * stream is scanned.
   */
  listParsed<T>(
    eventName: string,
    decode: (ev: unknown) => T | null,
    options?: { limit?: number },
  ): Promise<T[]>;
  /**
   * Wait for the event confirming `txid`. Resolves the event payload or
   * null on timeout (default 45s ≈ 2 blocks + indexer lag) — never throws
   * on timeout, mirroring ChainService.waitForEvent.
   */
  waitFor(txid: string, eventName: string, timeoutMs?: number): Promise<unknown>;
  /**
   * Canonical positional event-state slot decode (utils/chain-events
   * `eventValue`) — the single copy that retires the per-app duplicates.
   */
  value(ev: unknown, index: number): unknown;
  /**
   * Decode positional slots into a named record: `slots[i]` names the value
   * of state slot `i`. Missing slots decode to `undefined`.
   */
  record(ev: unknown, slots: string[]): Record<string, unknown>;
}

/** Clamp a user-supplied cap to a positive integer, defaulting when invalid. */
function boundedCap(cap: number | undefined): number {
  const raw = Number(cap ?? DEFAULT_LIST_ALL_CAP);
  return Number.isFinite(raw) && raw >= 1 ? Math.trunc(raw) : DEFAULT_LIST_ALL_CAP;
}

/** Normalize a tx hash for comparison: trim, lowercase, strip the 0x prefix. */
function normalizeTxid(txid: string): string {
  const raw = String(txid ?? "").trim().toLowerCase();
  return raw.startsWith("0x") ? raw.slice(2) : raw;
}

/**
 * Extract the tx hash from an event payload across indexer shapes: the
 * platform-mapped shape carries `tx_hash`, the raw N3Index shape `txid`.
 */
function eventTxid(ev: unknown): string {
  if (!ev || typeof ev !== "object") return "";
  const { tx_hash: txHash, txid } = ev as { tx_hash?: unknown; txid?: unknown };
  const raw = txHash ?? txid;
  return typeof raw === "string" ? normalizeTxid(raw) : "";
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Build the `app.events` surface over an injected chain-service slice.
 * See {@link FrameworkEventsSurface} for per-method semantics.
 */
export function createEventsSurface(deps: FrameworkEventsDeps): FrameworkEventsSurface {
  const { chain } = deps;

  const list = async (
    eventName: string,
    options?: { limit?: number; offset?: number },
  ): Promise<unknown[]> => (await chain.listEvents?.(eventName, options)) ?? [];

  const listAll = async (
    eventName: string,
    options?: { cap?: number },
  ): Promise<unknown[]> => {
    const cap = boundedCap(options?.cap);
    if (chain.listAllEvents) {
      const events = await chain.listAllEvents(eventName);
      return events.length > cap ? events.slice(0, cap) : events;
    }
    if (!chain.listEvents) return [];
    // Fallback pagination — mirrors useAllEvents: keep walking while pages
    // come back full, but never request past the cap.
    const events: unknown[] = [];
    let offset = 0;
    while (events.length < cap) {
      const page = await chain.listEvents(eventName, { limit: EVENT_PAGE_SIZE, offset });
      const items = Array.isArray(page) ? page : [];
      events.push(...items);
      if (items.length < EVENT_PAGE_SIZE) break;
      offset += EVENT_PAGE_SIZE;
    }
    return events.length > cap ? events.slice(0, cap) : events;
  };

  return {
    list,
    listAll,

    async listParsed<T>(
      eventName: string,
      decode: (ev: unknown) => T | null,
      options?: { limit?: number },
    ): Promise<T[]> {
      // Faithful delegation when the service can do the whole job itself.
      if (options?.limit === undefined && chain.listEventsParsed) {
        return chain.listEventsParsed(eventName, decode);
      }
      const events = options?.limit !== undefined
        ? await list(eventName, { limit: options.limit })
        : await listAll(eventName);
      return events.map(decode).filter((item): item is T => item !== null);
    },

    async waitFor(txid: string, eventName: string, timeoutMs?: number): Promise<unknown> {
      const timeout = timeoutMs ?? EVENT_WAIT_TIMEOUT_MS;
      if (chain.waitForEvent) {
        return (await chain.waitForEvent(txid, eventName, timeout)) ?? null;
      }
      const wanted = normalizeTxid(txid);
      if (!chain.listEvents || !wanted) return null;
      // Client-side fallback: scan recent events for the txid on the
      // wallet-sdk cadence (poll, then sleep 2.5s) until the deadline.
      const deadline = Date.now() + timeout;
      while (Date.now() < deadline) {
        const events = await list(eventName, { limit: EVENT_WAIT_SCAN_LIMIT });
        const match = events.find((ev) => eventTxid(ev) === wanted);
        if (match !== undefined) return match;
        await sleep(EVENT_WAIT_POLL_MS);
      }
      return null;
    },

    value(ev: unknown, index: number): unknown {
      return eventValue(ev, index);
    },

    record(ev: unknown, slots: string[]): Record<string, unknown> {
      const out: Record<string, unknown> = {};
      slots.forEach((slot, index) => {
        out[slot] = eventValue(ev, index);
      });
      return out;
    },
  };
}

// ---------------------------------------------------------------------------
// app.bus
// ---------------------------------------------------------------------------

/** A subscriber for one bus channel. */
export type FrameworkBusHandler = (payload: unknown) => void;

/**
 * The pub/sub slice `app.bus` delegates to — the apps/shared EventBus
 * surface (`ctx.services.events` in the platform host).
 */
export interface FrameworkBusChannel {
  /** Subscribe; returns the unsubscribe function. */
  on(event: string, handler: FrameworkBusHandler): () => void;
  /** Publish to all current subscribers of the channel. */
  emit(event: string, payload?: unknown): void;
  /** Remove one handler, or every handler of the channel when omitted. */
  off(event: string, handler?: FrameworkBusHandler): void;
}

/**
 * The lifecycle slice `app.bus` needs for auto-cleanup — a subset of the
 * apps/shared LifecycleService.
 */
export interface FrameworkBusLifecycle {
  /** Register a callback to run once when the miniapp unmounts. */
  onUnmount(fn: () => void): void;
}

/** Dependencies injected into {@link createBusSurface}. */
export interface FrameworkBusDeps {
  /**
   * Injected platform EventBus (`ctx.services.events`). Optional — when the
   * host doesn't provide one (standalone/OneGate) the surface degrades to a
   * private in-app bus with identical semantics. Migrated apps must be
   * handed the platform bus so cross-service channels
   * (platform:tx:confirmed, platform:balance:changed, ...) keep flowing.
   */
  bus?: FrameworkBusChannel;
  /**
   * Injected lifecycle slice. Optional — when present, every subscription
   * made through on/once is automatically released on miniapp unmount so
   * handlers cannot outlive the app.
   */
  lifecycle?: FrameworkBusLifecycle;
}

/** The `app.bus` object returned by {@link createBusSurface}. */
export interface FrameworkBusSurface {
  /**
   * Subscribe to a channel. Returns an unsubscribe function; when a
   * lifecycle dep is present the subscription is also auto-released on
   * unmount (manual unsubscribe first is safe — the unmount pass skips it).
   */
  on(event: string, handler: FrameworkBusHandler): () => void;
  /** Subscribe for a single firing, then auto-unsubscribe. */
  once(event: string, handler: FrameworkBusHandler): () => void;
  /** Publish to all current subscribers of the channel. */
  emit(event: string, payload?: unknown): void;
  /** Remove one handler, or every handler of the channel when omitted. */
  off(event: string, handler?: FrameworkBusHandler): void;
}

/**
 * Private fallback bus mirroring apps/shared EventBus semantics: handlers
 * are iterated over a snapshot (so a handler may remove itself mid-emit),
 * a throwing handler is logged and never breaks its siblings, and `off`
 * without a handler clears the whole channel.
 */
function createLocalBus(): FrameworkBusChannel {
  const handlers = new Map<string, Set<FrameworkBusHandler>>();

  const off = (event: string, handler?: FrameworkBusHandler): void => {
    if (!handler) {
      handlers.delete(event);
      return;
    }
    const set = handlers.get(event);
    if (!set) return;
    set.delete(handler);
    if (set.size === 0) handlers.delete(event);
  };

  return {
    on(event, handler) {
      const set = handlers.get(event) ?? new Set<FrameworkBusHandler>();
      handlers.set(event, set);
      set.add(handler);
      return () => off(event, handler);
    },
    emit(event, payload) {
      const set = handlers.get(event);
      if (!set || set.size === 0) return;
      for (const handler of [...set]) {
        try {
          handler(payload);
        } catch (error) {
          // Mirror EventBus: a bad subscriber must not break the others.
          console.error(`[framework.bus] Handler error for "${event}":`, error);
        }
      }
    },
    off,
  };
}

/**
 * Build the `app.bus` surface. Delegates to the injected platform EventBus
 * when present, else runs on a private in-app bus; when a lifecycle dep is
 * present every live on/once subscription is released on unmount.
 */
export function createBusSurface(deps: FrameworkBusDeps = {}): FrameworkBusSurface {
  const channel = deps.bus ?? createLocalBus();
  /** Unsubscribers of still-live subscriptions, flushed on unmount. */
  const live = new Set<() => void>();
  let unmountHooked = false;

  const hookUnmount = (): void => {
    if (unmountHooked || !deps.lifecycle) return;
    unmountHooked = true;
    deps.lifecycle.onUnmount(() => {
      for (const unsubscribe of [...live]) unsubscribe();
      live.clear();
    });
  };

  /**
   * Wrap a channel unsubscribe so a manual call removes itself from the
   * live set — the unmount flush then never double-offs a dead handler.
   */
  const track = (unsubscribe: () => void): (() => void) => {
    hookUnmount();
    const tracked = () => {
      live.delete(tracked);
      unsubscribe();
    };
    live.add(tracked);
    return tracked;
  };

  return {
    on(event, handler) {
      return track(channel.on(event, handler));
    },
    once(event, handler) {
      // Mirror EventBus.once: unsubscribe BEFORE invoking the handler so a
      // re-emit from inside the handler cannot re-enter it.
      let unsubscribe: () => void = () => {};
      const wrapper: FrameworkBusHandler = (payload) => {
        unsubscribe();
        handler(payload);
      };
      unsubscribe = track(channel.on(event, wrapper));
      return unsubscribe;
    },
    emit(event, payload) {
      channel.emit(event, payload);
    },
    off(event, handler) {
      channel.off(event, handler);
    },
  };
}
