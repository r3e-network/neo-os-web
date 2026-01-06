/**
 * MiniApp SDK Client
 * Implements bridge methods using NeoLine N3 provider
 */

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
const RPC_ENDPOINTS = {
  testnet: "https://testnet1.neo.coz.io:443",
  mainnet: "https://mainnet1.neo.coz.io:443",
};
let rpcRequestId = 0;

function resolveNetwork(config) {
  return config?.network === "mainnet" ? "mainnet" : "testnet";
}

async function rpcCall(method, params, network) {
  const endpoint = RPC_ENDPOINTS[network] || RPC_ENDPOINTS.testnet;
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

async function getApplicationLog(txid, network) {
  return rpcCall("getapplicationlog", [txid], network);
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

async function waitForReceipt(txid, network, attempts = 10, delayMs = 1200) {
  for (let i = 0; i < attempts; i++) {
    try {
      const log = await getApplicationLog(txid, network);
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
  const contractHash = config?.contractHash || null;
  const network = resolveNetwork(config);

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

    const res = await fetch(url.toString(), {
      method,
      headers,
      body: params && method !== "GET" ? JSON.stringify(params) : undefined,
      credentials: "include",
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
    const n3 = await getNeoLine();
    if (!n3) throw new Error("Wallet provider not connected");
    return n3.invoke({
      scriptHash: invocation.contract_hash,
      operation: invocation.method,
      args: invocation.params || [],
      broadcastOverride: false,
    });
  }

  async function payGasWithReceipt(targetAppId, amount, memo) {
    const response = await callEdge("pay-gas", {
      params: {
        app_id: targetAppId,
        amount_gas: amount,
        memo: memo || undefined,
      },
    });
    if (!(response?.request_id && response?.invocation)) {
      return response;
    }

    intentCache.set(response.request_id, response.invocation);
    const tx = await invokeWithWallet(response.invocation);
    const txid = tx?.txid || tx?.txHash || null;
    if (!txid) return response;

    const receiptId = await waitForReceipt(txid, network).catch(() => null);
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
        const contract = params.contract || contractHash;
        if (!contract) throw new Error("contract hash required");
        return rpcCall("invokefunction", [contract, params.method, params.args || []], params.network || network);
      }

      throw new Error(`Unsupported invoke method: ${method}`);
    },

    getConfig: () => ({
      appId,
      contractHash,
      debug: false,
    }),

    getAddress: async () => {
      const n3 = await getNeoLine();
      if (!n3) throw new Error("Wallet provider not connected");
      const { address } = await n3.getAccount();
      return address;
    },

    wallet: {
      getAddress: async () => {
        const n3 = await getNeoLine();
        if (!n3) throw new Error("Wallet provider not connected");
        const { address } = await n3.getAccount();
        return address;
      },
      invokeIntent: async (requestId) => {
        const invocation = intentCache.get(requestId);
        if (!invocation) throw new Error("Unknown intent request_id");
        return invokeWithWallet(invocation);
      },
    },

    payments: {
      payGAS: async (targetAppId, amount, memo) => {
        return payGasWithReceipt(targetAppId, amount, memo);
      },
      payGASAndInvoke: async (targetAppId, amount, memo) => {
        return payGasWithReceipt(targetAppId, amount, memo);
      },
    },

    governance: {
      vote: async (targetAppId, proposalId, neoAmount, support = true) => {
        const response = await callEdge("vote-neo", {
          params: {
            app_id: targetAppId,
            proposal_id: proposalId,
            neo_amount: neoAmount,
            support,
          },
        });
        if (response?.request_id && response?.invocation) {
          intentCache.set(response.request_id, response.invocation);
        }
        return response;
      },
      voteAndInvoke: async (targetAppId, proposalId, neoAmount, support = true) => {
        const response = await callEdge("vote-neo", {
          params: {
            app_id: targetAppId,
            proposal_id: proposalId,
            neo_amount: neoAmount,
            support,
          },
        });
        if (response?.request_id && response?.invocation) {
          intentCache.set(response.request_id, response.invocation);
          const tx = await invokeWithWallet(response.invocation);
          return { ...response, txid: tx?.txid || tx?.txHash || null };
        }
        return response;
      },
      getCandidates: async () => {
        const candidates = await rpcCall("getcandidates", [], network);
        const committee = await rpcCall("getcommittee", [], network).catch(() => []);
        const blockHeight = await rpcCall("getblockcount", [], network).catch(() => 0);
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
          params: { app_id: targetAppId },
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
    },

    stats: {
      getMyUsage: async (targetAppId, date) => {
        return callEdge("miniapp-usage", {
          method: "GET",
          query: { app_id: targetAppId || appId || undefined, date },
        });
      },
    },

    events: {
      list: async (params = {}) => {
        return callEdge("events-list", {
          method: "GET",
          query: params,
        });
      },
    },

    transactions: {
      list: async (params = {}) => {
        return callEdge("transactions-list", {
          method: "GET",
          query: params,
        });
      },
    },
  };
}
