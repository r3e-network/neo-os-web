/**
 * useVrfConsole -- Domain logic for Oracle VRF Console
 *
 * Uses createObservable instead of Vue ref/computed.
 * Called once during setup, returns observables that React components subscribe to.
 */

import { createObservable } from "@shared/react/context";
import type { Observable } from "@shared/react/context";
import type { OracleService } from "@shared/services";

export interface UseVrfConsoleOptions {
  oracle: OracleService;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export interface VrfRandomResult {
  requestId: string;
  value: string;
  proof: string;
}

export function useVrfConsole({ oracle, t }: UseVrfConsoleOptions) {
  const lastRandom = createObservable<VrfRandomResult | null>(null);

  const requestId: Observable<string> = {
    get: () => lastRandom.get()?.requestId || t("notAvailable"),
    set: () => {},
    subscribe: (fn) => lastRandom.subscribe(fn),
  };

  const randomValue: Observable<string> = {
    get: () => lastRandom.get()?.value || t("notAvailable"),
    set: () => {},
    subscribe: (fn) => lastRandom.subscribe(fn),
  };

  const proof: Observable<string> = {
    get: () => lastRandom.get()?.proof || t("notAvailable"),
    set: () => {},
    subscribe: (fn) => lastRandom.subscribe(fn),
  };

  const oracleHash: Observable<string> = {
    get: () => oracle.integration.contracts.morpheusOracle,
    set: () => {},
    subscribe: () => () => {},
  };

  const networkDisplay: Observable<string> = {
    get: () => oracle.network,
    set: () => {},
    subscribe: () => () => {},
  };

  const publicApiUrl: Observable<string> = {
    get: () => oracle.integration.morpheusPublicApiUrl,
    set: () => {},
    subscribe: () => () => {},
  };

  async function requestRandom() {
    const result = await oracle.requestRandom();
    lastRandom.set({
      requestId: result.requestId,
      value: result.randomBytes,
      proof: result.proof,
    });
    return { success: true };
  }

  const loadAll = async () => {};

  const isRequesting: Observable<boolean> = {
    get: () => oracle.isRequesting,
    set: () => {},
    subscribe: () => () => {},
  };

  return {
    lastRandom,
    requestId,
    randomValue,
    proof,
    oracleHash,
    networkDisplay,
    publicApiUrl,
    isRequesting,
    requestRandom,
    loadAll,
  };
}

export type UseVrfConsoleReturn = ReturnType<typeof useVrfConsole>;
