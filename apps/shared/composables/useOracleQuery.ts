/**
 * HTTP Oracle Query composable for Neo N3 MiniApps.
 *
 * Provides allowlisted HTTP oracle queries, NeoDID resolution,
 * and oracle public-key retrieval. Routed through the host-injected
 * MiniAppSDK or the platform edge gateway.
 */
import { createObservable } from "@shared/react/context";
import type { Observable } from "@shared/react/context";
import { getNetwork } from "../constants/rpc";
import {
  type OracleConfig,
  type OracleQueryRequest,
  type OracleQueryResponse,
  type NeoDidResolveResponse,
  type NeoDidProvidersResponse,
  type OraclePublicKeyResponse,
  normalizeEdgeBaseUrl,
  getWindowMiniAppSDK,
  requestEdgeJSON,
  requestExternalJson,
  toMiniAppError,
  ERROR_CODE_ORACLE_QUERY_FAILED,
  ERROR_CODE_NEODID_RESOLUTION_FAILED,
  ERROR_CODE_NEODID_PROVIDERS_FAILED,
  ERROR_CODE_ORACLE_PUBLIC_KEY_FAILED,
} from "./_oracleInternals";

export function useOracleQuery(config: OracleConfig = {}) {
  const network = config.network ?? getNetwork();
  const edgeBaseUrl = normalizeEdgeBaseUrl(config.edgeBaseUrl);
  const sdk = config.sdk ?? getWindowMiniAppSDK();

  const isRequesting: Observable<boolean> = createObservable(false);
  const error: Observable<string | null> = createObservable<string | null>(null);

  const queryAllowlistedUrl = async (params: OracleQueryRequest): Promise<OracleQueryResponse> => {
    isRequesting.set(true);
    error.set(null);
    try {
      if (config.hostSdk?.oracle?.query) {
        return await config.hostSdk.oracle.query(params);
      }
      return await requestEdgeJSON<OracleQueryResponse>(edgeBaseUrl, "/oracle-query", {
        method: "POST",
        body: {
          url: params.url,
          method: params.method,
          headers: params.headers,
          secret_name: params.secret_name,
          secret_as_key: params.secret_as_key,
          body: params.body,
        },
        getAuthToken: config.getAuthToken,
        getAPIKey: config.getAPIKey,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Oracle query failed";
      error.set(msg);
      throw toMiniAppError(e, "Oracle query failed", ERROR_CODE_ORACLE_QUERY_FAILED);
    } finally {
      isRequesting.set(false);
      error.set(null);
    }
  };

  const resolveNeoDid = async (did: string, format?: "resolution" | "document"): Promise<NeoDidResolveResponse> => {
    const trimmedDid = String(did ?? "").trim();
    if (!trimmedDid) {
      throw new Error("did is required");
    }

    isRequesting.set(true);
    error.set(null);
    try {
      const params = new URLSearchParams();
      params.set("did", trimmedDid);
      params.set("network", network);
      if (format === "document") params.set("format", "document");
      return await requestExternalJson<NeoDidResolveResponse>(`/api/morpheus/neodid/resolve?${params.toString()}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "NeoDID resolution failed";
      error.set(msg);
      throw toMiniAppError(e, "NeoDID resolution failed", ERROR_CODE_NEODID_RESOLUTION_FAILED);
    } finally {
      isRequesting.set(false);
      error.set(null);
    }
  };

  const getNeoDidProviders = async (): Promise<NeoDidProvidersResponse> => {
    isRequesting.set(true);
    error.set(null);
    try {
      return await requestExternalJson<NeoDidProvidersResponse>(`/api/morpheus/neodid/providers?network=${encodeURIComponent(network)}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "NeoDID providers request failed";
      error.set(msg);
      throw toMiniAppError(e, "NeoDID providers request failed", ERROR_CODE_NEODID_PROVIDERS_FAILED);
    } finally {
      isRequesting.set(false);
      error.set(null);
    }
  };

  const getOraclePublicKey = async (): Promise<OraclePublicKeyResponse> => {
    isRequesting.set(true);
    error.set(null);
    try {
      return await requestExternalJson<OraclePublicKeyResponse>(
        `/api/morpheus/oracle/public-key?network=${encodeURIComponent(network)}`,
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Oracle public key request failed";
      error.set(msg);
      throw toMiniAppError(e, "Oracle public key request failed", ERROR_CODE_ORACLE_PUBLIC_KEY_FAILED);
    } finally {
      isRequesting.set(false);
      error.set(null);
    }
  };

  return {
    network,
    isRequesting,
    error,
    queryAllowlistedUrl,
    resolveNeoDid,
    getNeoDidProviders,
    getOraclePublicKey,
  };
}
