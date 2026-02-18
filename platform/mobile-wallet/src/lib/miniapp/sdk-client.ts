/**
 * MiniApp SDK Client for Mobile Wallet
 * Creates SDK instance for communication with Edge functions
 */

import type { MiniAppSDKConfig, MiniAppSDK } from "./sdk-types";
import { getRpcUrl, resolveChainType } from "@/lib/chains";
import type { ChainType } from "@/lib/chains";
import { API_BASE_URL, EDGE_BASE_URL } from "@/lib/config";
let rpcRequestId = 0;

export function createMiniAppSDK(config: MiniAppSDKConfig): MiniAppSDK {
  const baseUrl = config.edgeBaseUrl || EDGE_BASE_URL;
  const chainId = config.chainId ?? null;
  const chainType = config.chainType ?? resolveChainType(chainId) ?? "neo-n3";
  const contractAddress = config.contractAddress ?? null;
  const supportedChains = config.supportedChains;
  const chainContracts = config.chainContracts;
  const uiConfig = config.uiConfig ?? null;
  const display = config.display ?? null;
  const layout = config.layout;

  async function fetchWithAuth(endpoint: string, options: RequestInit = {}): Promise<Response> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string>),
    };

    if (config.getAuthToken) {
      const token = await config.getAuthToken();
      if (token) headers["Authorization"] = `Bearer ${token}`;
    }

    if (config.getAPIKey) {
      const apiKey = await config.getAPIKey();
      if (apiKey) headers["X-API-Key"] = apiKey;
    }

    return fetch(`${baseUrl}${endpoint}`, { ...options, headers });
  }

  async function post<T>(endpoint: string, body: unknown): Promise<T> {
    const res = await fetchWithAuth(endpoint, {
      method: "POST",
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || "Request failed");
    }
    return res.json();
  }

  async function get<T>(endpoint: string, params?: Record<string, string>): Promise<T> {
    const url = params ? `${endpoint}?${new URLSearchParams(params)}` : endpoint;
    const res = await fetchWithAuth(url);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || "Request failed");
    }
    return res.json();
  }

  async function rpcCall(
    method: string,
    params: unknown[],
    targetChainId?: string | null,
    targetChainType?: ChainType
  ) {
    const resolvedChainType = targetChainType || chainType;
    const rpcUrl = getRpcUrl(targetChainId ?? null, resolvedChainType);
    if (!rpcUrl) {
      throw new Error("RPC endpoint unavailable");
    }
    const res = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: ++rpcRequestId,
        method,
        params,
      }),
    });
    if (!res.ok) {
      throw new Error(`RPC request failed: ${res.status}`);
    }
    const data = await res.json();
    if (data.error) {
      throw new Error(data.error.message || "RPC error");
    }
    return data.result;
  }

  return {
    getConfig: () => ({
      appId: config.appId,
      chainId,
      chainType: chainType || undefined,
      contractAddress,
      supportedChains,
      chainContracts,
      uiConfig,
      display,
      layout,
      debug: false,
    }),
    invokeRead: async (params) => {
      const contract =
        params.contract || (params as { contractHash?: string }).contractHash || contractAddress;
      const method = params.method || (params as { operation?: string }).operation;
      const targetChainId = params.chainId || chainId;
      const targetChainType = params.chainType || chainType;

      if (!contract) throw new Error("contract address required");
      if (!method) throw new Error("method required");
      return rpcCall(
        "invokefunction",
        [contract, method, params.args || []],
        targetChainId,
        targetChainType
      );
    },
    invokeFunction: async () => {
      throw new Error("invokeFunction is not supported in the mobile wallet host");
    },
    wallet: {
      getAddress: async () => {
        // This will be overridden by the bridge to use native wallet
        throw new Error("wallet.getAddress must be provided by native bridge");
      },
      invokeIntent: async (_requestId: string) => {
        // This will be overridden by the bridge to use native wallet
        throw new Error("wallet.invokeIntent must be provided by native bridge");
      },
    },
    payments: {
      payGAS: async (appId, amount, memo) => {
        return post("/pay-gas", {
          app_id: appId,
          amount_gas: amount,
          memo,
          chain_id: chainId || undefined,
        });
      },
    },
    governance: {
      vote: async (appId, proposalId, neoAmount, support) => {
        return post("/vote-neo", {
          app_id: appId,
          proposal_id: proposalId,
          neo_amount: neoAmount,
          support,
          chain_id: chainId || undefined,
        });
      },
      getCandidates: async () => {
        const candidates = await rpcCall("getcandidates", [], chainId, chainType);
        const committee = await rpcCall("getcommittee", [], chainId, chainType).catch(() => []);
        const blockHeight = await rpcCall("getblockcount", [], chainId, chainType).catch(() => 0);
        const committeeSet = new Set(Array.isArray(committee) ? committee : []);
        const list = Array.isArray(candidates)
          ? candidates.map((row) => ({
              address: row?.candidate || row?.address || "",
              publicKey: row?.publickey || row?.publicKey || row?.candidate || "",
              name: row?.name || undefined,
              votes: String(row?.votes ?? "0"),
              active: committeeSet.has(row?.candidate || row?.address || ""),
            }))
          : [];
        const totalVotes = list.reduce((sum, row) => sum + (Number(row.votes) || 0), 0);
        return {
          candidates: list,
          totalVotes: String(totalVotes),
          blockHeight: typeof blockHeight === "number" ? blockHeight : 0,
        };
      },
    },
    rng: {
      requestRandom: async (appId) => {
        return post("/rng-request", { app_id: appId, chain_id: chainId || undefined });
      },
    },
    datafeed: {
      getPrice: async (symbol) => {
        return get("/datafeed-price", { symbol });
      },
      getPrices: async () => {
        const res = await fetch(`${API_BASE_URL}/price`);
        if (!res.ok) throw new Error("Failed to fetch prices");
        return res.json();
      },
      getNetworkStats: async () => {
        const [blockCount, validators, version] = await Promise.all([
          rpcCall("getblockcount", [], chainId, chainType),
          rpcCall("getnextblockvalidators", [], chainId, chainType).catch(() => []),
          rpcCall("getversion", [], chainId, chainType).catch(() => ({})),
        ]);

        return {
          blockHeight: blockCount || 0,
          validatorCount: Array.isArray(validators) ? validators.length : 0,
          network: chainId || "neo-n3",
          version: version?.neoversion || version?.useragent || "unknown",
        };
      },
      getRecentTransactions: async (limit = 10) => {
        const blockCount = await rpcCall("getblockcount", [], chainId, chainType);
        const transactions: Array<{
          txid: string;
          blockHeight: number;
          blockTime?: number;
          sender?: string | null;
          size?: number;
          sysfee?: string;
          netfee?: string;
        }> = [];
        const blocksToFetch = Math.min(limit, 5);

        for (let i = 0; i < blocksToFetch && transactions.length < limit; i++) {
          const blockHeight = blockCount - 1 - i;
          if (blockHeight < 0) break;
          try {
            const block = await rpcCall("getblock", [blockHeight, true], chainId, chainType);
            if (block?.tx && Array.isArray(block.tx)) {
              for (const tx of block.tx) {
                if (transactions.length >= limit) break;
                transactions.push({
                  txid: tx.hash || tx.txid,
                  blockHeight,
                  blockTime: block.time,
                  sender: tx.sender || null,
                  size: tx.size || 0,
                  sysfee: tx.sysfee || "0",
                  netfee: tx.netfee || "0",
                });
              }
            }
          } catch {
            // Ignore individual block failures
          }
        }

        return { transactions, blockHeight: blockCount || 0 };
      },
    },
    stats: {
      getMyUsage: async (appId, date) => {
        const params: Record<string, string> = { app_id: appId };
        if (date) params.date = date;
        if (chainId) params.chain_id = chainId;
        return get("/miniapp-usage", params);
      },
    },
    events: {
      list: async (params) => {
        const query: Record<string, string> = {};
        if (params.app_id) query.app_id = params.app_id;
        if (params.event_name) query.event_name = params.event_name;
        if (params.contract_address) query.contract_address = params.contract_address;
        if (params.limit) query.limit = String(params.limit);
        if (params.after_id) query.after_id = params.after_id;
        if (params.chain_id) query.chain_id = params.chain_id;
        if (!query.chain_id && chainId) query.chain_id = chainId;
        return get("/events-list", query);
      },
    },
    transactions: {
      list: async (params) => {
        const query: Record<string, string> = {};
        if (params.app_id) query.app_id = params.app_id;
        if (params.limit) query.limit = String(params.limit);
        if (params.after_id) query.after_id = params.after_id;
        if (params.chain_id) query.chain_id = params.chain_id;
        if (!query.chain_id && chainId) query.chain_id = chainId;
        return get("/transactions-list", query);
      },
    },
  };
}
