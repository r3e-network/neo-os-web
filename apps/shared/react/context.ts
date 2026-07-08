/**
 * React Contexts for MiniApp
 *
 * Equivalent to Vue's provide/inject keys defined in miniapp-context.ts.
 * Each context provides a slice of the miniapp runtime to child components.
 */

import { createContext } from "react";
import type { Observable } from "../../../framework/reactive";
import type { MiniAppManifest } from "../types/miniapp-manifest";
import type { StatusType } from "../composables/useStatusMessage";
import type { PlatformServices } from "../services";
import type { OSServices } from "../services/os/types";
import type { MiniAppFramework } from "../../../framework";

// ============================================================================
// Observable State
// ============================================================================

// The Observable contract + createObservable implementation moved to the
// framework canonical (framework/reactive.ts — Wave 6 consolidation). These
// re-exports keep existing `@shared/react/context` imports working with the
// SAME function identity and type.
export type { Observable } from "../../../framework/reactive";
export { createObservable } from "../../../framework/reactive";

/**
 * Create a derived (computed) observable from one or more source observables.
 *
 * @param compute - Function that reads source observables and returns a derived value
 * @param deps - Source observables to subscribe to for change notifications
 */
export function createDerived<T>(
  compute: () => T,
  deps: Observable[] = [],
): Observable<T> {
  return {
    get: compute,
    set: () => {},
    subscribe(listener: () => void) {
      const unsubs = deps.map((dep) => dep.subscribe(listener));
      return () => unsubs.forEach((unsub) => unsub());
    },
  };
}

/**
 * Observable with a backward-compatible `.value` property. Consumers can use
 * either `obs.get()`/`obs.set()` (Observable) or `obs.value` (legacy Ref-style)
 * interchangeably.
 */
export type RefCompatObservable<T> = Observable<T> & { value: T };

/**
 * Wrap an Observable with a `.value` getter/setter for backward compat.
 *
 * The single shared definition for the byte-identical copies that previously
 * lived in ChainService and BalanceService.
 */
export function withValueCompat<T>(obs: Observable<T>): RefCompatObservable<T> {
  return Object.defineProperty(obs, "value", {
    get() {
      return obs.get();
    },
    set(v: T) {
      obs.set(v);
    },
    enumerable: true,
    configurable: true,
  }) as RefCompatObservable<T>;
}

/**
 * Adapt a Vue-style ref (object with .value property) to an Observable.
 * This allows composables written with Vue `ref()` to be used in the React runtime.
 *
 * For Vue computed refs (read-only), set() is a no-op.
 * Change notification is poll-based: the MiniAppRoot's state subscription
 * mechanism re-reads .get() on each render cycle.
 */
type RefLike<T> = {
  value: T;
  subscribe?: (listener: () => void) => () => void;
};

function isObservable<T>(value: Observable<T> | RefLike<T>): value is Observable<T> {
  return (
    typeof (value as Observable<T>).get === "function" &&
    typeof (value as Observable<T>).set === "function" &&
    typeof (value as Observable<T>).subscribe === "function"
  );
}

export function refToObservable<T>(vueRef: Observable<T> | RefLike<T>): Observable<T> {
  if (isObservable(vueRef)) return vueRef;

  const listeners = new Set<() => void>();
  let lastValue = vueRef.value;
  let sourceUnsubscribe: (() => void) | null = null;

  const notifyIfChanged = () => {
    const nextValue = vueRef.value;
    if (Object.is(lastValue, nextValue)) return;
    lastValue = nextValue;
    listeners.forEach((fn) => fn());
  };

  const subscribeToSource = () => {
    if (sourceUnsubscribe || typeof vueRef.subscribe !== "function") return;
    lastValue = vueRef.value;
    sourceUnsubscribe = vueRef.subscribe(notifyIfChanged);
  };

  const unsubscribeFromSourceIfIdle = () => {
    if (listeners.size > 0 || !sourceUnsubscribe) return;
    sourceUnsubscribe();
    sourceUnsubscribe = null;
    lastValue = vueRef.value;
  };

  return {
    get(): T {
      return vueRef.value;
    },
    set(value: T) {
      vueRef.value = value;
      notifyIfChanged();
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      subscribeToSource();
      return () => {
        listeners.delete(listener);
        unsubscribeFromSourceIfIdle();
      };
    },
  };
}

/**
 * Wrap a record of Vue refs into a record of Observables.
 * Passes through values that already have .get()/.set()/.subscribe() (Observable).
 */
export function refsToObservables(
  refs: Record<string, { value: unknown } | Observable>,
): ObservableState {
  const result: ObservableState = {};
  for (const [key, val] of Object.entries(refs)) {
    if (val && typeof (val as Observable).get === "function" && typeof (val as Observable).subscribe === "function") {
      result[key] = val as Observable;
    } else if (val && "value" in val) {
      result[key] = refToObservable(val as { value: unknown });
    }
  }
  return result;
}

/** Record of observable state values keyed by name */
export type ObservableState = Record<string, Observable>;

// ============================================================================
// Action dispatch single-flight guard
// ============================================================================

/**
 * Run `work` under a per-key single-flight guard. If an action with the same
 * `key` is already in flight (its key present in the shared `inFlight` set),
 * the call returns early with `undefined` instead of running `work` again —
 * preventing automatic double-submit (e.g. an impatient double click, or a
 * button press racing a programmatic dispatch of the same operation).
 *
 * The key is always removed in a `finally`, including when `work` throws, so a
 * failed dispatch never wedges the action permanently. The set is shared
 * between every dispatch entry point so the same logical operation cannot
 * overlap regardless of which path triggered it.
 */
export async function runSingleFlight<T>(
  inFlight: Set<string>,
  key: string,
  work: () => Promise<T>,
): Promise<T | undefined> {
  if (inFlight.has(key)) return undefined;
  inFlight.add(key);
  try {
    return await work();
  } finally {
    inFlight.delete(key);
  }
}

// ============================================================================
// MiniApp Context Type (React version)
// ============================================================================

export interface MiniAppContextValue {
  /** Platform services (chain, balance, transfer, oracle, AA, events, cache, notify, clipboard, fmt) */
  services: PlatformServices;
  /** OS system service proxies (storage, payment, game, badge, etc.) */
  os: OSServices;
  /** Translation function */
  t: (key: string, params?: Record<string, string | number>) => string;
  /** Observable state record */
  state: ObservableState;
  /** Set a status message (toast) */
  setStatus: (msg: string, type: StatusType) => void;
  /** Clear the current status message */
  clearStatus: () => void;
  /** Shared MiniApp framework SDK */
  framework: MiniAppFramework;
  /** Register an action handler for operation panel buttons */
  registerAction: (
    key: string,
    handler: (...args: unknown[]) => Promise<unknown>,
  ) => void;
}

// ============================================================================
// React Contexts
// ============================================================================

/** Provides the full MiniAppContext to child components */
export const MiniAppContext = createContext<MiniAppContextValue | null>(null);
MiniAppContext.displayName = "MiniAppContext";

/** Provides the manifest for reading in child components */
export const MiniAppManifestContext = createContext<MiniAppManifest | null>(
  null,
);
MiniAppManifestContext.displayName = "MiniAppManifestContext";

/** Provides the action handler registry */
export const MiniAppActionsContext = createContext<
  Map<string, (...args: unknown[]) => Promise<unknown>>
>(new Map());
MiniAppActionsContext.displayName = "MiniAppActionsContext";

/** Provides the observable state store */
export const MiniAppStateContext = createContext<ObservableState>({});
MiniAppStateContext.displayName = "MiniAppStateContext";
