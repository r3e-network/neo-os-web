(function () {
  if (typeof window === "undefined") return;
  if (window.MiniAppSDK) return;

  const isEmbedded = window.parent && window.parent !== window;
  if (!isEmbedded) return;

  const TYPES = {
    request: "miniapp_sdk_request",
    response: "miniapp_sdk_response",
    config: "miniapp_config",
  };

  let cachedConfig = null;
  if (window.__MINIAPP_CONFIG__ && typeof window.__MINIAPP_CONFIG__ === "object") {
    cachedConfig = window.__MINIAPP_CONFIG__;
  }

  function getParentOrigin() {
    const ref = String(document.referrer || "").trim();
    if (!ref) return "*";
    try {
      return new URL(ref).origin;
    } catch {
      return "*";
    }
  }

  const parentOrigin = getParentOrigin();

  function makeID() {
    try {
      if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
        return crypto.randomUUID();
      }
    } catch {
      // fall through
    }
    return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;
  }

  const pending = new Map();

  window.addEventListener("message", (event) => {
    const data = event.data;
    if (!data || typeof data !== "object") return;
    if (parentOrigin !== "*" && event.origin !== parentOrigin) return;

    if (data.type === TYPES.config && data.config && typeof data.config === "object") {
      cachedConfig = data.config;
      window.__MINIAPP_CONFIG__ = data.config;
      return;
    }

    if (data.type !== TYPES.response) return;

    const id = String(data.id || "").trim();
    if (!id) return;

    const entry = pending.get(id);
    if (!entry) return;
    pending.delete(id);

    if (data.ok) {
      entry.resolve(data.result);
    } else {
      entry.reject(new Error(String(data.error || "request failed")));
    }
  });

  function rpc(method, params) {
    const id = makeID();
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });

      try {
        window.parent.postMessage(
          { type: TYPES.request, id, method, params },
          parentOrigin,
        );
      } catch (err) {
        pending.delete(id);
        reject(err);
        return;
      }

      setTimeout(() => {
        if (!pending.has(id)) return;
        pending.delete(id);
        reject(new Error("request timeout"));
      }, 15000);
    });
  }

  const getConfig = () => {
    if (cachedConfig) return cachedConfig;
    if (window.__MINIAPP_CONFIG__ && typeof window.__MINIAPP_CONFIG__ === "object") {
      cachedConfig = window.__MINIAPP_CONFIG__;
      return cachedConfig;
    }
    return {
      appId: "",
      chainId: null,
      chainType: undefined,
      contractAddress: null,
      supportedChains: [],
      chainContracts: {},
      debug: false,
    };
  };

  window.MiniAppSDK = {
    invoke: (method, ...args) => rpc(method, args),
    getConfig,
    getAddress: () => rpc("wallet.getAddress", []),
    wallet: {
      getAddress: () => rpc("wallet.getAddress", []),
      invokeIntent: (requestId) => rpc("wallet.invokeIntent", [requestId]),
    },
    payments: {
      payGAS: (appId, amount, memo) => rpc("payments.payGAS", [appId, amount, memo]),
    },
    governance: {
      vote: (appId, proposalId, neoAmount, support) =>
        rpc("governance.vote", [appId, proposalId, neoAmount, support]),
    },
    rng: {
      requestRandom: (appId) => rpc("rng.requestRandom", [appId]),
    },
    datafeed: {
      getPrice: (symbol) => rpc("datafeed.getPrice", [symbol]),
    },
    stats: {
      getMyUsage: (appId, date) => rpc("stats.getMyUsage", [appId, date]),
    },
    events: {
      list: (params) => rpc("events.list", [params]),
    },
    transactions: {
      list: (params) => rpc("transactions.list", [params]),
    },
  };

  try {
    window.dispatchEvent(new Event("miniapp-sdk-ready"));
  } catch {
    // Ignore dispatch failures in older environments.
  }
})();
