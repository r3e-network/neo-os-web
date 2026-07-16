export interface Observable<T = unknown> {
  get(): T;
  set(value: T): void;
  subscribe(listener: () => void): () => void;
}

export function createObservable<T>(initial: T): Observable<T> {
  let current = initial;
  const listeners = new Set<() => void>();

  return {
    get() {
      return current;
    },
    set(value: T) {
      if (Object.is(current, value)) return;
      current = value;
      listeners.forEach((listener) => listener());
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/** Lifecycle of a {@link ReadCell}: has the read been attempted, and how did it end? */
export type ReadCellStatus = "idle" | "loading" | "ready" | "error";

/** A data source's value plus the platform-owned answer to "have we asked yet?". */
export interface ReadCell<T> {
  /**
   * `undefined` means "not read yet" — pendingKey-compatible by construction.
   * Set by the cell on each successful load; the owning composable MAY also
   * `set()` it after a verified write (it just round-tripped the new truth).
   */
  value: Observable<T | undefined>;
  /** Settles on BOTH outcomes — a thrown loader flips to "error", never sticks at "loading". */
  status: Observable<ReadCellStatus>;
  /** Run the loader. Resolves/rejects with THIS call's outcome even when superseded. */
  load(): Promise<T>;
  /** Back to idle + undefined, and invalidates any in-flight load's publish. */
  reset(): void;
}

/**
 * createReadCell — the platform-owned "have we asked yet?" signal (read-cell pilot).
 *
 * The session census found 29 of 54 non-game apps hand-deriving settledness for
 * `resolvePhase`, each with its own `*Settled` boolean / `*Status` union /
 * `*ObservedAt` timestamp (council-governance `balancesSettled`, self-loan's six
 * `LoadStatus` observables, neo-convert's literal `"idle"|"loading"|"ready"|"error"`
 * union, wallet-health's `neoObservedAt > 0`, explorer's `statsStatus`, gasbox's
 * `catalogStatus` + `isLoadingMachines` + `catalogError` trio…). Adopting a cell
 * deletes that hand-rolled pair per data source: `status` replaces the settled
 * signal, `value === undefined` replaces the "no data yet" sentinel, and
 * `resolvePhase({ loading: status === "loading", settled: status === "ready" ||
 * status === "error", hasData })` needs no app-owned bookkeeping.
 *
 * Semantics:
 * - `value` stays `undefined` until the FIRST successful read. A settled empty
 *   result is the loader's business (return `[]` / `null` / a domain verdict —
 *   never resolve `undefined`, which is reserved for "not read yet").
 * - The throw path settles: a sync throw or async rejection flips `status` to
 *   "error" (guarded like a `finally` — see below) and `load()` rejects.
 *   `value` keeps the last good data so stale-but-real stays renderable.
 * - Concurrency is LAST-WRITE-WINS via a monotonic epoch: overlapping `load()`
 *   calls each run the loader, but only the newest call publishes value/status.
 *   `reset()` joins the epoch, so it also invalidates in-flight publishes — the
 *   fleet's hand-rolled `identityRevision` guard, owned here. Callers wanting
 *   in-flight dedup instead compose it: wrap the loader with `singleFlight`
 *   (framework/utils/async-utils) and keep the cell for publication.
 * - A loader that returns a plain value publishes SYNCHRONOUSLY (no microtask
 *   gap), so sync storage probes keep their guard ordering when migrated.
 */
export function createReadCell<T>(loader: () => T | Promise<T>): ReadCell<T> {
  const value = createObservable<T | undefined>(undefined);
  const status = createObservable<ReadCellStatus>("idle");
  let epoch = 0;

  const publish = (ticket: number, next: T) => {
    if (ticket !== epoch) return;
    value.set(next);
    status.set("ready");
  };
  // The "finally" of the throw path: always runs on failure, but only the
  // still-current call may settle the shared status.
  const settleError = (ticket: number) => {
    if (ticket === epoch) status.set("error");
  };

  return {
    value,
    status,
    load(): Promise<T> {
      const ticket = ++epoch;
      status.set("loading");
      let result: T | Promise<T>;
      try {
        result = loader();
      } catch (error) {
        settleError(ticket);
        return Promise.reject(error);
      }
      if (
        result !== null &&
        (typeof result === "object" || typeof result === "function") &&
        typeof (result as PromiseLike<T>).then === "function"
      ) {
        return Promise.resolve(result).then(
          (resolved) => {
            publish(ticket, resolved);
            return resolved;
          },
          (error) => {
            settleError(ticket);
            throw error;
          },
        );
      }
      publish(ticket, result as T);
      return Promise.resolve(result as T);
    },
    reset() {
      epoch += 1;
      value.set(undefined);
      status.set("idle");
    },
  };
}

/**
 * Combine boolean observables into a read-only "busy" observable that is true
 * while ANY source is true. `set` is a no-op (derived value); subscribing
 * subscribes to every source and the returned unsubscribe releases all of
 * them.
 *
 * Promoted from the byte-identical hand-rolled composite observables that
 * lived in miniapp composables (gov-merc, self-loan); canonical home of
 * apps/shared/utils/observables.ts — shared re-exports from here.
 */
export function combineBusy(
  ...sources: Observable<boolean>[]
): Observable<boolean> {
  return {
    get: () => sources.some((source) => source.get()),
    set: () => {},
    subscribe(listener: () => void) {
      const unsubs = sources.map((source) => source.subscribe(listener));
      return () => {
        unsubs.forEach((unsub) => unsub());
      };
    },
  };
}
