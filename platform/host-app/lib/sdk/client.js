/**
 * MiniApp SDK Client (stub)
 */

/**
 * Create a MiniApp SDK instance
 * @param {Object} config
 * @returns {Object}
 */
export function createMiniAppSDK(config) {
  const baseUrl = config?.baseUrl || "/api/rpc";

  return {
    getAddress: async () => null,
    wallet: {
      getAddress: async () => null,
      invokeIntent: async () => null,
    },
    payments: {
      payGAS: async () => ({ txHash: null }),
    },
    governance: {
      vote: async () => ({ txHash: null }),
    },
    rng: {
      requestRandom: async () => ({ requestId: null }),
    },
    datafeed: {
      getPrice: async () => ({ price: "0" }),
    },
    stats: {
      getMyUsage: async () => ({}),
    },
    events: {
      list: async () => ({ events: [] }),
    },
    transactions: {
      list: async () => ({ transactions: [] }),
    },
  };
}
