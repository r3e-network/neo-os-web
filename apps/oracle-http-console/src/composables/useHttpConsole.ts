/**
 * useHttpConsole -- Domain logic for Oracle HTTP Console
 *
 * Uses createObservable instead of Vue ref/computed.
 * Called once during setup, returns observables that React components subscribe to.
 */

import { createObservable } from "@shared/react/context";
import type { Observable } from "@shared/react/context";
import type { OracleService } from "@shared/services";

export interface UseHttpConsoleOptions {
  oracle: OracleService;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export interface HttpResponse {
  status_code: number;
  headers: Record<string, string>;
  body: string;
}

export function useHttpConsole({ oracle, t }: UseHttpConsoleOptions) {
  const url = createObservable("");
  const method = createObservable("GET");
  const secretName = createObservable("");
  const secretAsKey = createObservable("");
  const body = createObservable("");

  const response = createObservable<HttpResponse | null>(null);

  const responseHeaders: Observable<string> = {
    get: () => JSON.stringify(response.get()?.headers ?? {}, null, 2),
    set: () => {},
    subscribe: (fn) => response.subscribe(fn),
  };

  const responseBody: Observable<string> = {
    get: () => String(response.get()?.body ?? t("notAvailable")),
    set: () => {},
    subscribe: (fn) => response.subscribe(fn),
  };

  const methodDisplay: Observable<string> = {
    get: () => method.get() || t("methodPlaceholder"),
    set: () => {},
    subscribe: (fn) => method.subscribe(fn),
  };

  const statusCode: Observable<string> = {
    get: () => String(response.get()?.status_code ?? t("notAvailable")),
    set: () => {},
    subscribe: (fn) => response.subscribe(fn),
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

  async function runQuery() {
    const result = await oracle.queryAllowlistedUrl({
      url: url.get(),
      method: method.get() || "GET",
      secret_name: secretName.get() || undefined,
      secret_as_key: secretAsKey.get() || undefined,
      body: body.get() || undefined,
    });
    response.set(result as unknown as HttpResponse);
    return { success: true };
  }

  const loadAll = async () => {};

  const isRequesting: Observable<boolean> = {
    get: () => oracle.isRequesting,
    set: () => {},
    subscribe: () => () => {},
  };

  return {
    url,
    method,
    secretName,
    secretAsKey,
    body,
    response,
    responseHeaders,
    responseBody,
    methodDisplay,
    statusCode,
    oracleHash,
    networkDisplay,
    publicApiUrl,
    isRequesting,
    runQuery,
    loadAll,
  };
}

export type UseHttpConsoleReturn = ReturnType<typeof useHttpConsole>;
