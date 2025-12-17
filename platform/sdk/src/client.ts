import type {
  MiniAppSDK,
  MiniAppSDKConfig,
  PayGASResponse,
  PriceResponse,
  RNGResponse,
  VoteNEOResponse,
} from "./types.js";

async function requestJSON<T>(
  cfg: MiniAppSDKConfig,
  path: string,
  init: RequestInit,
): Promise<T> {
  const base = cfg.edgeBaseUrl.replace(/\\/$/, "");
  const url = `${base}${path.startsWith("/") ? "" : "/"}${path}`;

  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  if (cfg.getAuthToken) {
    const token = await cfg.getAuthToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }

  const resp = await fetch(url, { ...init, headers });
  const text = await resp.text();
  if (!resp.ok) throw new Error(text || `request failed (${resp.status})`);
  return JSON.parse(text) as T;
}

export function createMiniAppSDK(cfg: MiniAppSDKConfig): MiniAppSDK {
  return {
    wallet: {
      async getAddress() {
        throw new Error("wallet integration not configured (use NeoLine/O3 dAPI in host app)");
      },
    },
    payments: {
      async payGAS(appId: string, amount: string, memo?: string): Promise<PayGASResponse> {
        return requestJSON<PayGASResponse>(cfg, "/pay-gas", {
          method: "POST",
          body: JSON.stringify({ app_id: appId, amount_gas: amount, memo }),
        });
      },
    },
    governance: {
      async vote(appId: string, proposalId: string, neoAmount: string, support?: boolean): Promise<VoteNEOResponse> {
        return requestJSON<VoteNEOResponse>(cfg, "/vote-neo", {
          method: "POST",
          body: JSON.stringify({
            app_id: appId,
            proposal_id: proposalId,
            neo_amount: neoAmount,
            support,
          }),
        });
      },
    },
    rng: {
      async requestRandom(appId: string): Promise<RNGResponse> {
        return requestJSON<RNGResponse>(cfg, "/rng-request", {
          method: "POST",
          body: JSON.stringify({ app_id: appId }),
        });
      },
    },
    datafeed: {
      async getPrice(symbol: string): Promise<PriceResponse> {
        const base = cfg.edgeBaseUrl.replace(/\\/$/, "");
        const url = `${base}/datafeed-price?symbol=${encodeURIComponent(symbol)}`;
        const resp = await fetch(url);
        const text = await resp.text();
        if (!resp.ok) throw new Error(text || `request failed (${resp.status})`);
        return JSON.parse(text) as PriceResponse;
      },
    },
  };
}

