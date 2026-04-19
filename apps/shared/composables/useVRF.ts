/**
 * VRF (Verifiable Random Function) composable for Neo N3 MiniApps.
 *
 * Provides verifiable randomness via the Morpheus VRF oracle, routed through
 * the host-injected MiniAppSDK or the platform edge gateway.
 */
import { createObservable } from "@shared/react/context";
import type { Observable } from "@shared/react/context";
import { getNetwork } from "../constants/rpc";
import {
  type OracleConfig,
  type VRFResult,
  normalizeEdgeBaseUrl,
  getWindowMiniAppSDK,
  requestEdgeJSON,
  toMiniAppError,
  ERROR_CODE_RNG_FAILED,
} from "./_oracleInternals";

export function useVRF(config: OracleConfig = {}) {
  const network = config.network ?? getNetwork();
  const edgeBaseUrl = normalizeEdgeBaseUrl(config.edgeBaseUrl);
  const sdk = config.sdk ?? getWindowMiniAppSDK();

  const isRequesting: Observable<boolean> = createObservable(false);
  const error: Observable<string | null> = createObservable<string | null>(null);
  const lastRandom: Observable<VRFResult | null> = createObservable<VRFResult | null>(null);

  const requestRandomness = async (_requestLabel?: string): Promise<VRFResult> => {
    const appId = String(config.appId ?? "").trim();
    if (!appId) {
      throw new Error("appId is required for RNG requests");
    }

    isRequesting.set(true);
    error.set(null);
    try {
      const response = sdk?.rng
        ? await sdk.rng.requestRandom(appId)
        : await requestEdgeJSON<Record<string, unknown>>(edgeBaseUrl, "/rng-request", {
            method: "POST",
            body: { app_id: appId },
            getAuthToken: config.getAuthToken,
          });

      const result: VRFResult = {
        value: String(response.randomness ?? ""),
        proof: String(response.signature ?? ""),
        requestId: String(response.request_id ?? ""),
        blockNumber: 0,
        publicKey: String(response.public_key ?? "") || undefined,
        attestationHash: String(response.attestation_hash ?? "") || undefined,
        raw: response,
      };
      lastRandom.set(result);
      return result;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "RNG request failed";
      error.set(msg);
      throw toMiniAppError(e, "RNG request failed", ERROR_CODE_RNG_FAILED);
    } finally {
      isRequesting.set(false);
      error.set(null);
    }
  };

  return {
    network,
    isRequesting,
    error,
    lastRandom,
    requestRandomness,
  };
}
