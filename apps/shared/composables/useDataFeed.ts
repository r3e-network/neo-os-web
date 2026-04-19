/**
 * DataFeed / Price Feed composable for Neo N3 MiniApps.
 *
 * Reads asset prices from the Morpheus DataFeed oracle. Resolution order:
 *   1. Host-injected MiniAppSDK (production iframe path)
 *   2. Host-app proxy at `${edgeBaseUrl}/datafeed-price?symbol=X` (when
 *      EDGE_BASE_URL points at a Supabase Functions deployment)
 *   3. Public Cloudflare gateway at `${publicApiUrl}/feeds/price/{sym}`
 *      (always reachable; no auth needed; the same TEE-signed payload)
 *
 * Falling back to the public gateway means pricefeeds work in any
 * environment where the canonical platform URLs resolve, even if the
 * host-app's Supabase proxy isn't deployed.
 */
import { createObservable } from "@shared/react/context";
import type { Observable } from "@shared/react/context";
import { EXTERNAL_INTEGRATIONS, getNetwork } from "../constants/rpc";
import {
  type OracleConfig,
  normalizeEdgeBaseUrl,
  getWindowMiniAppSDK,
  mapAssetToSymbol,
  requestEdgeJSON,
  toMiniAppError,
  ERROR_CODE_DATA_FEED_FAILED,
} from "./_oracleInternals";

interface PriceLikePayload {
  price?: unknown;
  quotes?: Array<{ price?: unknown; raw_price?: unknown }>;
}

function pickPriceFromPayload(payload: PriceLikePayload | null | undefined): number | null {
  if (!payload || typeof payload !== "object") return null;
  const direct = Number.parseFloat(String(payload.price ?? ""));
  if (Number.isFinite(direct) && direct > 0) return direct;
  // Cloudflare-gateway shape: { quotes: [{ price: "2.846", raw_price: "2.846" }, ...] }
  const quote = Array.isArray(payload.quotes) ? payload.quotes[0] : undefined;
  if (quote) {
    const q = Number.parseFloat(String(quote.price ?? quote.raw_price ?? ""));
    if (Number.isFinite(q) && q > 0) return q;
  }
  return null;
}

async function fetchFromPublicGateway(symbol: string, network: string): Promise<number | null> {
  try {
    const networkKey = network === "neo-n3-mainnet" ? "mainnet" : "testnet";
    const base = EXTERNAL_INTEGRATIONS[networkKey]?.morpheusPublicApiUrl;
    if (!base) return null;
    const url = `${String(base).replace(/\/$/, "")}/feeds/price/${encodeURIComponent(symbol)}`;
    const res = await fetch(url, { method: "GET" });
    if (!res.ok) return null;
    const body = await res.json().catch(() => null);
    return pickPriceFromPayload(body as PriceLikePayload);
  } catch {
    return null;
  }
}

export function useDataFeed(config: OracleConfig = {}) {
  const network = config.network ?? getNetwork();
  const edgeBaseUrl = normalizeEdgeBaseUrl(config.edgeBaseUrl);
  const sdk = config.sdk ?? getWindowMiniAppSDK();

  const error: Observable<string | null> = createObservable<string | null>(null);

  const getPrice = async (asset: "NEO" | "GAS" | string): Promise<number> => {
    error.set(null);
    try {
      const symbol = mapAssetToSymbol(asset);

      // 1. Host SDK (production iframe path)
      if (sdk?.datafeed) {
        const response = await sdk.datafeed.getPrice(symbol);
        const price = pickPriceFromPayload(response as PriceLikePayload);
        if (price != null) return price;
        // fall through to remote paths if SDK returned a malformed payload
      }

      // 2. Host-app /api/rpc proxy → Supabase function `datafeed-price`.
      //    May 404 if Supabase isn't configured for this environment;
      //    in that case we fall through to the public gateway.
      try {
        const response = await requestEdgeJSON<PriceLikePayload>(
          edgeBaseUrl,
          `/datafeed-price?symbol=${encodeURIComponent(symbol)}`,
          { method: "GET", getAuthToken: config.getAuthToken },
        );
        const price = pickPriceFromPayload(response);
        if (price != null) return price;
      } catch {
        /* fall through */
      }

      // 3. Public Cloudflare gateway. Always reachable; no auth.
      const fallback = await fetchFromPublicGateway(symbol, network);
      if (fallback != null) return fallback;

      throw new Error(`no datafeed source returned a valid price for ${symbol}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "DataFeed request failed";
      error.set(msg);
      throw toMiniAppError(e, "DataFeed request failed", ERROR_CODE_DATA_FEED_FAILED);
    } finally {
      error.set(null);
    }
  };

  return {
    network,
    error,
    getPrice,
  };
}
