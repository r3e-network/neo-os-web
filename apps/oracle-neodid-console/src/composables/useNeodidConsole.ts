/**
 * useNeodidConsole -- Domain logic for Oracle NeoDID Console
 *
 * Uses createObservable instead of Vue ref/computed.
 * Called once during setup, returns observables that React components subscribe to.
 */

import { createObservable } from "@shared/react/context";
import type { Observable } from "@shared/react/context";
import type { OracleService } from "@shared/services";

export interface UseNeodidConsoleOptions {
  oracle: OracleService;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export function useNeodidConsole({ oracle, t }: UseNeodidConsoleOptions) {
  const did = createObservable("did:morpheus:neo_n3:service:neodid");
  const format = createObservable("resolution");
  const latestPayload = createObservable<Record<string, unknown> | null>(null);
  const providersPayload = createObservable<Record<string, unknown> | null>(null);

  function normalizeFormat(value: string): "resolution" | "document" {
    return String(value || "").trim().toLowerCase() === "document" ? "document" : "resolution";
  }

  function applyExample(kind: "service" | "vault" | "aa") {
    if (kind === "service") {
      did.set("did:morpheus:neo_n3:service:neodid");
      format.set("resolution");
      return;
    }
    if (kind === "vault") {
      did.set("did:morpheus:neo_n3:vault:6d0656f6dd91469db1c90cc1e574380613f43738");
      format.set("document");
      return;
    }
    did.set("did:morpheus:neo_n3:aa:demo-account");
    format.set("document");
  }

  const providerCount: Observable<number> = {
    get: () => {
      const pp = providersPayload.get();
      if (Array.isArray(pp)) return pp.length;
      if (pp && typeof pp === "object") return Object.keys(pp).length;
      return 0;
    },
    set: () => {},
    subscribe: (fn) => providersPayload.subscribe(fn),
  };

  const renderedPayload: Observable<string> = {
    get: () => JSON.stringify(latestPayload.get() ?? providersPayload.get() ?? {}, null, 2) || t("notAvailable"),
    set: () => {},
    subscribe: (fn) => {
      const u1 = latestPayload.subscribe(fn);
      const u2 = providersPayload.subscribe(fn);
      return () => { u1(); u2(); };
    },
  };

  const formatDisplay: Observable<string> = {
    get: () => normalizeFormat(format.get()),
    set: () => {},
    subscribe: (fn) => format.subscribe(fn),
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

  const neodidContract: Observable<string> = {
    get: () => oracle.integration.contracts.morpheusNeoDid || t("externalResolver"),
    set: () => {},
    subscribe: () => () => {},
  };

  const neodidDomain: Observable<string> = {
    get: () => oracle.integration.domains.neodid || t("notPublished"),
    set: () => {},
    subscribe: () => () => {},
  };

  async function resolveDid() {
    latestPayload.set(await oracle.resolveDidWithFormat(did.get(), normalizeFormat(format.get())) as Record<string, unknown>);
    return { success: true };
  }

  async function loadProviders() {
    const result = await oracle.getDidProviders() as Record<string, unknown>;
    providersPayload.set(result);
    latestPayload.set(result);
    return { success: true };
  }

  const loadAll = async () => {};

  const isRequesting: Observable<boolean> = {
    get: () => oracle.isRequesting,
    set: () => {},
    subscribe: () => () => {},
  };

  return {
    did,
    format,
    latestPayload,
    providersPayload,
    providerCount,
    renderedPayload,
    formatDisplay,
    networkDisplay,
    publicApiUrl,
    neodidContract,
    neodidDomain,
    isRequesting,
    normalizeFormat,
    applyExample,
    resolveDid,
    loadProviders,
    loadAll,
  };
}

export type UseNeodidConsoleReturn = ReturnType<typeof useNeodidConsole>;
