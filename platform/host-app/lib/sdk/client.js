/**
 * MiniApp SDK Client
 * Implements bridge methods for multi-chain providers.
 */

import { getChainRegistry } from "../chains/registry";

async function getNeoLine() {
  if (typeof window === "undefined") return null;
  // Retry mechanism for wallet injection
  let attempts = 0;
  while (!window.NEOLineN3 && attempts < 10) {
    await new Promise((resolve) => setTimeout(resolve, 200));
    attempts++;
  }

  if (!window.NEOLineN3) {
    console.warn("NeoLine N3 provider not detected");
    return null;
  }
  return new window.NEOLineN3.Init();
}

const intentCache = new Map();

function cacheIntent(requestId, invocation) {
  if (!requestId || !invocation) return;
  intentCache.set(requestId, {
    invocation,
    invoked: false,
    result: null,
    txid: null,
    receipt_id: null,
  });
}

function getIntent(requestId) {
  return intentCache.get(requestId) || null;
}

function updateIntent(requestId, updates) {
  const entry = intentCache.get(requestId);
  if (!entry) return;
  intentCache.set(requestId, { ...entry, ...updates });
}

function extractTxId(result) {
  if (!result || typeof result !== "object") return null;
  return result.txid || result.txHash || result.transactionHash || null;
}
const DEFAULT_NEO_RPC_ENDPOINTS = {
  testnet: "https://testnet1.neo.coz.io:443",
  mainnet: "https://mainnet1.neo.coz.io:443",
};
let rpcRequestId = 0;

function resolveNeoNetwork(chainId, config) {
  if (chainId && String(chainId).includes("mainnet")) return "mainnet";
  return config?.network === "mainnet" ? "mainnet" : "testnet";
}

function inferChainType(chainId, config) {
  if (config?.chainType) return config.chainType;
  if (chainId && String(chainId).startsWith("neo-n3")) return "neo-n3";
  return "evm";
}

function resolveRpcUrl(chainId, chainType, config) {
  const registry = getChainRegistry();
  const chain = chainId ? registry.getChain(chainId) : null;
  if (chain && Array.isArray(chain.rpcUrls) && chain.rpcUrls.length > 0) {
    return chain.rpcUrls[0];
  }
  if (chainType === "neo-n3") {
    const fallback = resolveNeoNetwork(chainId, config);
    return DEFAULT_NEO_RPC_ENDPOINTS[fallback] || DEFAULT_NEO_RPC_ENDPOINTS.testnet;
  }
  return null;
}

function getEvmProvider() {
  if (typeof window === "undefined") return null;
  return window.ethereum || null;
}

async function getEvmAddress() {
  const provider = getEvmProvider();
  if (!provider) throw new Error("EVM wallet not detected");
  const accounts = await provider.request({ method: "eth_requestAccounts" });
  const address = accounts && accounts[0] ? String(accounts[0]) : "";
  if (!address) throw new Error("EVM wallet address unavailable");
  return address;
}

function toHexQuantity(value) {
  if (!value) return undefined;
  const raw = String(value).trim();
  if (!raw) return undefined;
  if (raw.startsWith("0x")) return raw;
  const parsed = BigInt(raw);
  return `0x${parsed.toString(16)}`;
}

async function rpcCall(method, params, chainId, chainType, config) {
  const endpoint = resolveRpcUrl(chainId, chainType, config);
  if (!endpoint) {
    throw new Error("RPC endpoint unavailable");
  }
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: ++rpcRequestId,
      method,
      params,
    }),
  });
  if (!response.ok) {
    throw new Error(`RPC request failed: ${response.status}`);
  }
  const data = await response.json();
  if (data.error) {
    throw new Error(`RPC error: ${data.error.message}`);
  }
  return data.result;
}

async function getApplicationLog(txid, chainId, chainType, config) {
  return rpcCall("getapplicationlog", [txid], chainId, chainType, config);
}

function extractReceiptIdFromLog(log) {
  const execution = log?.executions?.[0];
  const notifications = execution?.notifications || [];
  for (const notification of notifications) {
    const eventName = notification?.eventname || notification?.eventName || notification?.name;
    if (eventName !== "PaymentReceived") continue;
    const state = notification?.state;
    const values = Array.isArray(state?.value) ? state.value : Array.isArray(state) ? state : [];
    const first = values[0];
    if (first?.type === "Integer" && first?.value !== undefined) {
      return String(first.value);
    }
    if (first?.value !== undefined) {
      return String(first.value);
    }
  }
  return null;
}

async function waitForReceipt(txid, chainId, chainType, config, attempts = 10, delayMs = 1200) {
  for (let i = 0; i < attempts; i++) {
    try {
      const log = await getApplicationLog(txid, chainId, chainType, config);
      const receiptId = extractReceiptIdFromLog(log);
      if (receiptId) return receiptId;
    } catch (e) {
      if (i === attempts - 1) throw e;
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  return null;
}

/**
 * Create a MiniApp SDK instance
 * @param {Object} config
 * @returns {Object}
 */
export function createMiniAppSDK(config) {
  const baseUrl = config?.edgeBaseUrl || config?.baseUrl || "/api/rpc";
  const appId = config?.appId || "";
  const chainId = config?.chainId || null;
  const chainType = inferChainType(chainId, config);
  const contractAddress = config?.contractAddress || null;
  const supportedChains = Array.isArray(config?.supportedChains) ? config.supportedChains : [];
  const chainContracts = config?.chainContracts || null;

  async function resolveAuthHeaders() {
    const headers = {};
    if (config?.getAuthToken) {
      const token = await config.getAuthToken();
      if (token) headers.Authorization = `Bearer ${token}`;
    }
    if (!headers.Authorization && config?.getAPIKey) {
      const apiKey = await config.getAPIKey();
      if (apiKey) headers["X-API-Key"] = apiKey;
    }
    return headers;
  }

  async function callEdge(fn, { method = "POST", params = null, query = null } = {}) {
    const base = baseUrl.replace(/\/$/, "");
    const url = new URL(`${base}/${fn}`, window.location.origin);
    if (query) {
      Object.entries(query).forEach(([key, value]) => {
        if (value === undefined || value === null) return;
        url.searchParams.set(key, String(value));
      });
    }

    const headers = {
      "Content-Type": "application/json",
      ...(await resolveAuthHeaders()),
    };

    const isCrossOrigin = url.origin !== window.location.origin;

    const res = await fetch(url.toString(), {
      method,
      headers,
      body: params && method !== "GET" ? JSON.stringify(params) : undefined,
      credentials: isCrossOrigin ? "omit" : "include",
    });

    const contentType = res.headers.get("content-type") || "";
    const payload = contentType.includes("application/json") ? await res.json() : await res.text();
    if (!res.ok) {
      const message = payload?.error?.message || payload?.message || payload || "Request failed";
      throw new Error(message);
    }
    return payload;
  }

  async function invokeWithWallet(invocation) {
    const invocationType = invocation?.chain_type || invocation?.chainType || chainType;
    if (invocationType === "evm") {
      const provider = getEvmProvider();
      if (!provider) throw new Error("EVM wallet not connected");
      const from = await getEvmAddress();
      const to = invocation?.contract_address;
      const data = invocation?.data;
      if (!to || !data) {
        throw new Error("EVM invocation missing contract_address or data");
      }
      const tx = {
        from,
        to,
        data,
        value: toHexQuantity(invocation?.value),
        gas: toHexQuantity(invocation?.gas),
        gasPrice: toHexQuantity(invocation?.gas_price),
      };
      const txHash = await provider.request({ method: "eth_sendTransaction", params: [tx] });
      return { tx_hash: txHash };
    }

    const n3 = await getNeoLine();
    if (!n3) throw new Error("Wallet provider not connected");
    return n3.invoke({
      scriptHash: invocation.contract_address,
      operation: invocation.method,
      args: invocation.params || [],
      broadcastOverride: false,
    });
  }

  async function requestPayGasIntent(targetAppId, amount, memo) {
    const response = await callEdge("pay-gas", {
      params: {
        app_id: targetAppId,
        amount_gas: amount,
        memo: memo || undefined,
        chain_id: chainId || undefined,
      },
    });
    if (response?.request_id && response?.invocation) {
      cacheIntent(response.request_id, response.invocation);
    }
    return response;
  }

  async function invokeIntent(requestId) {
    const entry = getIntent(requestId);
    if (!entry?.invocation) throw new Error("Unknown intent request_id");
    if (entry.invoked && entry.result) return entry.result;
    const result = await invokeWithWallet(entry.invocation);
    const txid = extractTxId(result);
    updateIntent(requestId, { invoked: true, result, txid });
    return result;
  }

  async function payGasAndInvoke(targetAppId, amount, memo) {
    const response = await requestPayGasIntent(targetAppId, amount, memo);
    const requestId = response?.request_id;
    if (!requestId || !response?.invocation) return response;

    const result = await invokeIntent(requestId);
    const txid = extractTxId(result);
    if (!txid) return { ...response, txid: null };

    if (chainType !== "neo-n3") {
      return { ...response, txid };
    }

    const receiptId = await waitForReceipt(txid, chainId, chainType, config).catch(() => null);
    updateIntent(requestId, { receipt_id: receiptId });
    if (receiptId) {
      const entry = getIntent(requestId);
      if (entry) {
        intentCache.set(String(receiptId), entry);
      }
    }
    return { ...response, txid, receipt_id: receiptId };
  }

  return {
    // Generic invoke method for bridge calls
    invoke: async (method, params) => {
      // Validate inputs
      if (!method || typeof method !== "string") {
        throw new Error("Invalid method");
      }

      // Handle contract invocations via Wallet
      if (method === "invokeFunction" && params) {
        const targetChainType = params.chainType || params.chain_type || chainType;
        if (targetChainType === "evm") {
          const provider = getEvmProvider();
          if (!provider) throw new Error("EVM wallet provider not connected");
          const from = await getEvmAddress();
          const to = params.contract || params.to;
          const data = params.data;
          if (!to || !data) throw new Error("EVM invocation requires contract/to and data");
          return provider.request({
            method: "eth_sendTransaction",
            params: [
              {
                from,
                to,
                data,
                value: toHexQuantity(params.value),
                gas: toHexQuantity(params.gas),
                gasPrice: toHexQuantity(params.gas_price),
              },
            ],
          });
        }

        const n3 = await getNeoLine();
        if (!n3) throw new Error("Wallet provider not connected");

        try {
          const result = await n3.invoke({
            scriptHash: params.contract,
            operation: params.method,
            args: params.args || [],
            broadcastOverride: false,
          });
          return result;
        } catch (e) {
          console.error("Contract invocation failed:", e);
          throw e;
        }
      }

      if (method === "invokeRead" && params) {
        const targetChainId = params.chainId || params.chain_id || chainId;
        const targetChainType = params.chainType || params.chain_type || chainType;
        if (targetChainType === "evm") {
          const provider = getEvmProvider();
          if (!provider) throw new Error("EVM wallet provider not connected");
          const to = params.contract || params.to;
          const data = params.data;
          if (!to || !data) throw new Error("EVM invokeRead requires contract/to and data");
          return provider.request({ method: "eth_call", params: [{ to, data }, "latest"] });
        }
        const contract = params.contract;
        if (!contract) throw new Error("contract address required");
        return rpcCall("invokefunction", [contract, params.method, params.args || []], targetChainId, targetChainType, config);
      }

      throw new Error(`Unsupported invoke method: ${method}`);
    },

    getConfig: () => ({
      appId,
      chainId,
      chainType,
      contractAddress,
      supportedChains,
      chainContracts,
      debug: false,
    }),

    getAddress: async () => {
      if (chainType === "evm") {
        return getEvmAddress();
      }
      const n3 = await getNeoLine();
      if (!n3) throw new Error("Wallet provider not connected");
      const { address } = await n3.getAccount();
      return address;
    },

    wallet: {
      getAddress: async () => {
        if (chainType === "evm") {
          return getEvmAddress();
        }
        const n3 = await getNeoLine();
        if (!n3) throw new Error("Wallet provider not connected");
        const { address } = await n3.getAccount();
        return address;
      },
      switchChain: async (nextChainId) => {
        if (!nextChainId) throw new Error("chainId required");
        const { useWalletStore } = await import("../wallet/store");
        await useWalletStore.getState().switchChain(nextChainId);
      },
      signMessage: async (message) => {
        if (chainType === "evm") {
          const provider = getEvmProvider();
          if (!provider) throw new Error("EVM wallet provider not connected");
          const from = await getEvmAddress();
          return provider.request({ method: "personal_sign", params: [message, from] });
        }
        const n3 = await getNeoLine();
        if (!n3) throw new Error("Wallet provider not connected");
        return n3.signMessage({ message });
      },
      invokeIntent: async (requestId) => {
        return invokeIntent(String(requestId ?? ""));
      },
    },

    payments: {
      payGAS: async (targetAppId, amount, memo) => {
        return requestPayGasIntent(targetAppId, amount, memo);
      },
      payGASAndInvoke: async (targetAppId, amount, memo) => {
        return payGasAndInvoke(targetAppId, amount, memo);
      },
    },

    governance: {
      vote: async (targetAppId, proposalId, neoAmount, support = true) => {
        if (chainType === "evm") {
          throw new Error("governance voting is only supported on neo-n3 chains");
        }
        const response = await callEdge("vote-neo", {
          params: {
            app_id: targetAppId,
            proposal_id: proposalId,
            neo_amount: neoAmount,
            support,
            chain_id: chainId || undefined,
          },
        });
        if (response?.request_id && response?.invocation) {
          cacheIntent(response.request_id, response.invocation);
        }
        return response;
      },
      voteAndInvoke: async (targetAppId, proposalId, neoAmount, support = true) => {
        if (chainType === "evm") {
          throw new Error("governance voting is only supported on neo-n3 chains");
        }
        const response = await callEdge("vote-neo", {
          params: {
            app_id: targetAppId,
            proposal_id: proposalId,
            neo_amount: neoAmount,
            support,
            chain_id: chainId || undefined,
          },
        });
        if (response?.request_id && response?.invocation) {
          cacheIntent(response.request_id, response.invocation);
          const result = await invokeIntent(response.request_id);
          return { ...response, txid: extractTxId(result) };
        }
        return response;
      },
      getCandidates: async () => {
        if (chainType === "evm") {
          throw new Error("governance candidates are only available on neo-n3 chains");
        }
        const candidates = await rpcCall("getcandidates", [], chainId, chainType, config);
        const committee = await rpcCall("getcommittee", [], chainId, chainType, config).catch(() => []);
        const blockHeight = await rpcCall("getblockcount", [], chainId, chainType, config).catch(() => 0);
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
      requestRandom: async (targetAppId) => {
        return callEdge("rng-request", {
          params: { app_id: targetAppId, chain_id: chainId || undefined },
        });
      },
    },

    datafeed: {
      getPrice: async (symbol) => {
        return callEdge("datafeed-price", {
          method: "GET",
          query: { symbol },
        });
      },
      getPrices: async () => {
        // Fetch NEO/GAS prices from global price API
        const res = await fetch("/api/price");
        if (!res.ok) throw new Error("Failed to fetch prices");
        return res.json();
      },
      getNetworkStats: async () => {
        if (chainType === "evm") {
          const provider = getEvmProvider();
          if (!provider) throw new Error("EVM wallet provider not connected");
          const blockHex = await provider.request({ method: "eth_blockNumber" });
          const blockHeight = parseInt(String(blockHex || "0x0"), 16);
          return {
            blockHeight: Number.isFinite(blockHeight) ? blockHeight : 0,
            validatorCount: 0,
            network: chainId || "evm",
            version: "evm",
          };
        }
        // Fetch network stats from Neo RPC
        const [blockCount, validators, version] = await Promise.all([
          rpcCall("getblockcount", [], chainId, chainType, config),
          rpcCall("getnextblockvalidators", [], chainId, chainType, config).catch(() => []),
          rpcCall("getversion", [], chainId, chainType, config).catch(() => ({})),
        ]);
        return {
          blockHeight: blockCount || 0,
          validatorCount: Array.isArray(validators) ? validators.length : 0,
          network: chainId || "neo-n3",
          version: version?.neoversion || version?.useragent || "unknown",
        };
      },
      getRecentTransactions: async (limit = 10) => {
        if (chainType === "evm") {
          const provider = getEvmProvider();
          if (!provider) throw new Error("EVM wallet provider not connected");
          const blockHex = await provider.request({ method: "eth_blockNumber" });
          const blockHeight = parseInt(String(blockHex || "0x0"), 16);
          return { transactions: [], blockHeight: Number.isFinite(blockHeight) ? blockHeight : 0 };
        }
        // Fetch recent blocks and extract transactions
        const blockCount = await rpcCall("getblockcount", [], chainId, chainType, config);
        const transactions = [];
        const blocksToFetch = Math.min(limit, 5);

        for (let i = 0; i < blocksToFetch && transactions.length < limit; i++) {
          const blockHeight = blockCount - 1 - i;
          if (blockHeight < 0) break;
          try {
            const block = await rpcCall("getblock", [blockHeight, true], chainId, chainType, config);
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
          } catch (e) {
            console.warn(`Failed to fetch block ${blockHeight}:`, e);
          }
        }
        return { transactions, blockHeight: blockCount };
      },
    },

    stats: {
      getMyUsage: async (targetAppId, date) => {
        return callEdge("miniapp-usage", {
          method: "GET",
          query: { app_id: targetAppId || appId || undefined, date, chain_id: chainId || undefined },
        });
      },
    },

    events: {
      list: async (params = {}) => {
        const query = { ...params };
        if (!query.chain_id && chainId) query.chain_id = chainId;
        return callEdge("events-list", {
          method: "GET",
          query,
        });
      },
      emit: async (eventName, data = {}) => {
        return callEdge("emit-event", {
          method: "POST",
          params: { app_id: appId, event_name: eventName, state: data, chain_id: chainId || undefined },
        });
      },
    },

    transactions: {
      list: async (params = {}) => {
        const query = { ...params };
        if (!query.chain_id && chainId) query.chain_id = chainId;
        return callEdge("transactions-list", {
          method: "GET",
          query,
        });
      },
    },

    notifications: {
      send: async (title, message, opts = {}) => {
        return callEdge("send-notification", {
          method: "POST",
          params: { app_id: appId, title, message, chain_id: chainId || undefined, ...opts },
        });
      },
      list: async (params = {}) => {
        return callEdge("miniapp-notifications", {
          method: "GET",
          query: { app_id: appId, chain_id: chainId || undefined, ...params },
        });
      },
    },
  };
}
