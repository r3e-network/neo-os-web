/**
 * React Contexts for MiniApp
 *
 * Equivalent to Vue's provide/inject keys defined in miniapp-context.ts.
 * Each context provides a slice of the miniapp runtime to child components.
 */

import { createContext } from "react";
import type { MiniAppManifest } from "../types/miniapp-manifest";
import type { StatusType } from "../composables/useStatusMessage";
import type { PlatformServices } from "../services";
import type { OSServices } from "../services/os/types";

// ============================================================================
// Observable State
// ============================================================================

/** A single observable value — the React equivalent of Vue's Ref<T> */
export interface Observable<T = unknown> {
  /** Current value */
  get(): T;
  /** Update the value and notify subscribers */
  set(value: T): void;
  /** Subscribe to changes. Returns an unsubscribe function. */
  subscribe(listener: () => void): () => void;
}

/** Create a simple observable value (pub/sub store) */
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
      listeners.forEach((fn) => fn());
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/**
 * Create a derived (computed) observable from one or more source observables.
 *
 * @param compute - Function that reads source observables and returns a derived value
 * @param deps - Source observables to subscribe to for change notifications
 */
export function createDerived<T>(
  compute: () => T,
  deps: Observable[],
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
 * Adapt a Vue-style ref (object with .value property) to an Observable.
 * This allows composables written with Vue `ref()` to be used in the React runtime.
 *
 * For Vue computed refs (read-only), set() is a no-op.
 * Change notification is poll-based: the MiniAppRoot's state subscription
 * mechanism re-reads .get() on each render cycle.
 */
export function refToObservable<T>(vueRef: { value: T }): Observable<T> {
  const listeners = new Set<() => void>();
  let lastValue = vueRef.value;

  return {
    get(): T {
      return vueRef.value;
    },
    set(value: T) {
      vueRef.value = value;
      if (!Object.is(lastValue, value)) {
        lastValue = value;
        listeners.forEach((fn) => fn());
      }
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
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
