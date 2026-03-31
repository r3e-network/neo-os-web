/**
 * DataFeed / Price Feed composable for Neo N3 MiniApps.
 *
 * Reads asset prices from the Morpheus DataFeed oracle, routed through
 * the host-injected MiniAppSDK or the platform edge gateway.
 */
import { ref } from "vue";
import { getNetwork } from "../constants/rpc";
import {
  type OracleConfig,
  normalizeEdgeBaseUrl,
  getWindowMiniAppSDK,
  mapAssetToSymbol,
  requestEdgeJSON,
  toMiniAppError,
  ERROR_CODE_DATA_FEED_FAILED,
} from "./_oracleInternals";

export function useDataFeed(config: OracleConfig = {}) {
  const network = config.network ?? getNetwork();
  const edgeBaseUrl = normalizeEdgeBaseUrl(config.edgeBaseUrl);
  const sdk = config.sdk ?? getWindowMiniAppSDK();

  const error = ref<string | null>(null);

  const getPrice = async (asset: "NEO" | "GAS" | string): Promise<number> => {
    error.value = null;
    try {
      const symbol = mapAssetToSymbol(asset);
      const response = sdk?.datafeed
        ? await sdk.datafeed.getPrice(symbol)
        : await requestEdgeJSON<Record<string, unknown>>(edgeBaseUrl, `/datafeed-price?symbol=${encodeURIComponent(symbol)}`, {
            method: "GET",
            getAuthToken: config.getAuthToken,
          });

      const price = Number.parseFloat(String(response.price ?? "0"));
      if (!Number.isFinite(price)) {
        throw new Error(`invalid price response for ${symbol}`);
      }
      return price;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "DataFeed request failed";
      error.value = msg;
      throw toMiniAppError(e, "DataFeed request failed", ERROR_CODE_DATA_FEED_FAILED);
    } finally {
      error.value = null;
    }
  };

  return {
    network,
    error,
    getPrice,
  };
}
