const MAINNET_MAGIC = 860833102;
const TESTNET_MAGIC = 894710606;
const DEFAULT_REQUEST_TIMEOUT_MS = 10000;
function encodeBase64Utf8(value) {
  if (typeof btoa !== "function") return value;
  return btoa(unescape(encodeURIComponent(value)));
}
function createNonce() {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.getRandomValues === "function"
  ) {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
      "",
    );
  }
  return `${Date.now().toString(16)}${Math.random().toString(16).slice(2)}`;
}
function isNeoDapiProvider(candidate) {
  if (!candidate || typeof candidate !== "object") return false;
  const provider = candidate;
  return (
    typeof provider.getAccounts === "function" ||
    typeof provider.authenticate === "function"
  );
}
function readImmediateDapiProvider() {
  if (typeof window === "undefined") return null;
  const g = window;
  const candidates = [g.Neo?.DapiProvider, g.neoDapiProvider, g.neoDapi];
  return candidates.find(isNeoDapiProvider) ?? null;
}
function waitForDapiProvider(timeoutMs = 750) {
  const immediate = readImmediateDapiProvider();
  if (immediate) return Promise.resolve(immediate);
  if (typeof window === "undefined") return Promise.resolve(null);
  return new Promise((resolve) => {
    let settled = false;
    const finish = (provider) => {
      if (settled) return;
      settled = true;
      window.removeEventListener("Neo.DapiProvider.ready", onReady);
      resolve(provider);
    };
    const onReady = (event) => {
      const provider = event.detail?.provider;
      if (isNeoDapiProvider(provider)) finish(provider);
    };
    window.addEventListener("Neo.DapiProvider.ready", onReady);
    setTimeout(() => finish(null), timeoutMs);
    window.dispatchEvent(
      new CustomEvent("Neo.DapiProvider.request", {
        detail: { version: "1.0" },
      }),
    );
  });
}
function getAuthenticationDomain() {
  if (typeof window === "undefined") return "localhost";
  return window.location.host || window.location.hostname || "localhost";
}
async function getNeoDapiContext(allowAuthenticate = true) {
  const provider = await waitForDapiProvider();
  if (!provider) return null;
  let accounts = [];
  if (provider.getAccounts) {
    try {
      accounts = await provider.getAccounts();
    } catch {
      accounts = [];
    }
  }
  const account = accounts.find((entry) => entry.isDefault) ?? accounts[0];
  if (account) {
    const address = String(account.address ?? account.hash ?? "").trim();
    if (address) {
      return {
        kind: "nep21",
        address,
        accountHash: String(account.hash ?? "").trim() || undefined,
        provider,
      };
    }
  }
  if (!allowAuthenticate || !provider.authenticate) return null;
  const authenticated = await provider.authenticate({
    action: "Authentication",
    grant_type: "Signature",
    allowed_algorithms: ["ECDSA-P256"],
    domain: getAuthenticationDomain(),
    networks: provider.supportedNetworks?.length
      ? provider.supportedNetworks
      : [MAINNET_MAGIC, TESTNET_MAGIC],
    nonce: createNonce(),
    timestamp: Date.now(),
  });
  const address = String(authenticated.address ?? "").trim();
  if (!address) return null;
  return { kind: "nep21", address, provider };
}
async function getNeoLineContext() {
  if (typeof window === "undefined") return null;
  const g = window;
  const neoline = g.NEOLineN3 ?? g.NEOLine;
  if (!neoline || typeof neoline.Init !== "function") return null;
  const instance = new neoline.Init();
  if (!instance || typeof instance.getAccount !== "function") return null;
  const res = await instance.getAccount();
  const address = String(res?.address ?? res?.account?.address ?? "").trim();
  if (!address) return null;
  return { kind: "neoline", address, instance };
}
async function getEvmContext() {
  if (typeof window === "undefined") return null;
  const g = window;
  if (!g.ethereum || typeof g.ethereum.request !== "function") return null;
  try {
    const accounts = await g.ethereum.request({ method: "eth_accounts" });
    if (Array.isArray(accounts) && accounts.length > 0) {
      const address = String(accounts[0] ?? "").trim();
      if (address) return { kind: "evm", address, provider: g.ethereum };
    }
  } catch {
    // User denied request or wallet unavailable — try the next wallet option.
  }
  return null;
}
async function getInjectedWalletContext(options = {}) {
  if (typeof window === "undefined") {
    throw new Error("wallet methods must be called in a browser context");
  }
  const dapi = await getNeoDapiContext(options.allowDapiAuthenticate ?? true);
  if (dapi) return dapi;
  const neoline = await getNeoLineContext();
  if (neoline) return neoline;
  if (options.includeEvm ?? true) {
    const evm = await getEvmContext();
    if (evm) return evm;
  }
  throw new Error(
    "NEP-21 dAPI or NeoLine N3 wallet not detected, or host must bridge wallet methods",
  );
}
async function getInjectedWalletAddress() {
  return (await getInjectedWalletContext()).address;
}
async function getWalletProviderInfo() {
  const context = await getInjectedWalletContext({
    allowDapiAuthenticate: false,
  });
  if (context.kind === "nep21") {
    return {
      kind: "nep21",
      name: context.provider.name || "NEP-21 dAPI",
      network: context.provider.network,
      address: context.address,
      accountHash: context.accountHash,
    };
  }
  if (context.kind === "neoline")
    return { kind: "neoline", name: "NeoLine N3", address: context.address };
  return { kind: "evm", name: "EIP-1193", address: context.address };
}
async function signInjectedWalletMessage(message) {
  const context = await getInjectedWalletContext({ includeEvm: false });
  if (context.kind === "nep21") {
    if (!context.provider.signMessage)
      throw new Error("NEP-21 wallet does not support signMessage");
    const signed = await context.provider.signMessage(
      encodeBase64Utf8(message),
      context.accountHash ?? context.address,
    );
    const signature = String(signed.signature ?? signed.data ?? "");
    return {
      publicKey: String(signed.pubkey ?? signed.publicKey ?? ""),
      data: signature,
      signature,
      account: signed.account,
      salt: String(signed.salt ?? ""),
      message: String(signed.message ?? message),
    };
  }
  if (context.kind === "neoline" && context.instance.signMessage) {
    return context.instance.signMessage({ message });
  }
  throw new Error("Connected wallet does not support signMessage");
}
// Resolve SENDER placeholder in invocation params with the user's wallet address.
// This is used for GAS.Transfer where the 'from' parameter must be the user's address.
function resolveInvocationParams(params, userAddress) {
  return params.map((param) => {
    if (param.type === "Hash160" && param.value === "SENDER") {
      return { type: "Hash160", value: userAddress };
    }
    if (param.type === "Array" && Array.isArray(param.value)) {
      return {
        type: "Array",
        value: resolveInvocationParams(param.value, userAddress),
      };
    }
    return param;
  });
}
async function invokeDirectInvocation(invocation) {
  const context = await getInjectedWalletContext();
  const scriptHash = String(invocation.contract_hash ?? "").trim();
  const operation = String(invocation.method ?? "").trim();
  if (!scriptHash) throw new Error("invocation missing contract_hash");
  if (!operation) throw new Error("invocation missing method");
  if (context.kind === "evm") {
    const data = "0x"; // Evm encoding placeholder
    return await context.provider.request({
      method: "eth_sendTransaction",
      params: [
        {
          from: context.address,
          to: scriptHash,
          data: data,
        },
      ],
    });
  }
  const signerAccount =
    context.kind === "nep21"
      ? (context.accountHash ?? context.address)
      : context.address;
  // Resolve SENDER placeholders in params with the user's actual Neo account.
  const rawArgs = Array.isArray(invocation.params) ? invocation.params : [];
  const args = resolveInvocationParams(rawArgs, signerAccount);
  if (context.kind === "nep21") {
    if (!context.provider.invoke) {
      throw new Error("NEP-21 wallet does not support invoke");
    }
    return context.provider.invoke(
      [{ hash: scriptHash, operation, args }],
      [{ account: signerAccount, scopes: "CalledByEntry" }],
    );
  }
  if (!context.instance || typeof context.instance.invoke !== "function") {
    throw new Error(
      "wallet does not support invoke (NEP-21 dAPI or NeoLine N3 required)",
    );
  }
  // Try strict CalledByEntry signer payloads with/without 0x script hash prefix.
  const candidates = [
    {
      scriptHash,
      operation,
      args,
      signers: [{ account: signerAccount, scopes: "CalledByEntry" }],
    },
    {
      scriptHash: scriptHash.replace(/^0x/i, ""),
      operation,
      args,
      signers: [{ account: signerAccount, scopes: "CalledByEntry" }],
    },
  ];
  let lastErr = null;
  for (const params of candidates) {
    try {
      return await context.instance.invoke(params);
    } catch (err) {
      lastErr = err;
    }
  }
  const tried = candidates
    .map(
      (c, i) =>
        `#${i + 1}{scriptHash=${c.scriptHash},scopes=${String(c.signers?.[0]?.scopes ?? "none")}}`,
    )
    .join("; ");
  const lastMessage =
    lastErr instanceof Error
      ? lastErr.message
      : String(lastErr ?? "invoke failed");
  throw new Error(
    `NeoLine invoke failed after ${candidates.length} candidate(s): ${tried}. Last error: ${lastMessage}`,
  );
}
async function requestJSON(cfg, path, init) {
  const base = cfg.edgeBaseUrl.replace(/\/$/, "");
  const url = `${base}${path.startsWith("/") ? "" : "/"}${path}`;
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  if (cfg.getAuthToken) {
    const token = await cfg.getAuthToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }
  if (!headers.get("Authorization") && cfg.getAPIKey) {
    const apiKey = await cfg.getAPIKey();
    if (apiKey) headers.set("X-API-Key", apiKey);
  }
  const resp = await fetch(url, {
    ...init,
    headers,
    signal: init.signal ?? AbortSignal.timeout(DEFAULT_REQUEST_TIMEOUT_MS),
  });
  const text = await resp.text();
  if (!resp.ok) throw new Error(`request failed (${resp.status})`);
  try {
    const parsed = JSON.parse(text);
    if (typeof parsed !== "object" || parsed === null) {
      throw new Error(`unexpected non-object response from ${path}`);
    }
    return parsed;
  } catch (err) {
    if (err instanceof SyntaxError)
      throw new Error(`invalid JSON response from ${path}`);
    throw new Error(
      `requestJSON(${path}) failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}
async function requestHostJSON(cfg, path, init) {
  const base = cfg.edgeBaseUrl.replace(/\/$/, "");
  const url = `${base}${path.startsWith("/") ? "" : "/"}${path}`;
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  const apiKey = cfg.getAPIKey ? await cfg.getAPIKey() : undefined;
  if (!apiKey) {
    throw new Error("API key required for host-only endpoint");
  }
  headers.set("X-API-Key", apiKey);
  const resp = await fetch(url, {
    ...init,
    headers,
    signal: init.signal ?? AbortSignal.timeout(DEFAULT_REQUEST_TIMEOUT_MS),
  });
  const text = await resp.text();
  if (!resp.ok) throw new Error(`request failed (${resp.status})`);
  try {
    const parsed = JSON.parse(text);
    if (typeof parsed !== "object" || parsed === null) {
      throw new Error(`unexpected non-object response from ${path}`);
    }
    return parsed;
  } catch (err) {
    if (err instanceof SyntaxError)
      throw new Error(`invalid JSON response from ${path}`);
    throw new Error(
      `requestHostJSON(${path}) failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}
export function createMiniAppSDK(cfg) {
  const pendingInvocations = new Map();
  return {
    async getAddress() {
      return getInjectedWalletAddress();
    },
    wallet: {
      async getAddress() {
        return getInjectedWalletAddress();
      },
      async getProviderInfo() {
        return getWalletProviderInfo();
      },
      async signMessage(message) {
        return signInjectedWalletMessage(message);
      },
      async invokeIntent(requestId) {
        const id = String(requestId ?? "").trim();
        if (!id) throw new Error("request_id required");
        const invocation = pendingInvocations.get(id);
        if (!invocation)
          throw new Error("unknown request_id (no pending invocation)");
        pendingInvocations.delete(id);
        return invokeDirectInvocation(invocation);
      },
      async invokeInvocation(invocation) {
        return invokeDirectInvocation(invocation);
      },
    },
    payments: {
      async payGAS(appId, amount, memo) {
        const res = await requestJSON(cfg, "/pay-gas", {
          method: "POST",
          body: JSON.stringify({ app_id: appId, amount_gas: amount, memo }),
        });
        pendingInvocations.set(res.request_id, res.invocation);
        return res;
      },
      async payGASAndInvoke(appId, amount, memo) {
        const intent = await this.payGAS(appId, amount, memo);
        const tx = await invokeDirectInvocation(intent.invocation);
        return { intent, tx };
      },
    },
    governance: {
      async vote(appId, proposalId, bneoAmount, support) {
        const res = await requestJSON(cfg, "/vote-bneo", {
          method: "POST",
          body: JSON.stringify({
            app_id: appId,
            proposal_id: proposalId,
            bneo_amount: bneoAmount,
            support,
          }),
        });
        pendingInvocations.set(res.request_id, res.invocation);
        return res;
      },
      async voteAndInvoke(appId, proposalId, bneoAmount, support) {
        const intent = await this.vote(appId, proposalId, bneoAmount, support);
        const tx = await invokeDirectInvocation(intent.invocation);
        return { intent, tx };
      },
    },
    rng: {
      async requestRandom(appId) {
        return requestJSON(cfg, "/rng-request", {
          method: "POST",
          body: JSON.stringify({ app_id: appId }),
        });
      },
    },
    datafeed: {
      async getPrice(symbol) {
        if (!symbol || typeof symbol !== "string" || !symbol.trim())
          throw new Error("symbol is required");
        return requestJSON(
          cfg,
          `/datafeed-price?symbol=${encodeURIComponent(symbol)}`,
          {
            method: "GET",
          },
        );
      },
    },
    stats: {
      async getMyUsage(appId, date) {
        const resolvedAppId = String(appId ?? cfg.appId ?? "").trim();
        const qs = new URLSearchParams();
        if (resolvedAppId) qs.set("app_id", resolvedAppId);
        if (date) qs.set("date", date);
        const path = qs.toString()
          ? `/miniapp-usage?${qs.toString()}`
          : "/miniapp-usage";
        const res = await requestJSON(cfg, path, { method: "GET" });
        return res.usage;
      },
    },
    events: {
      async list(params) {
        const qs = new URLSearchParams();
        if (params.app_id) qs.set("app_id", params.app_id);
        if (params.event_name) qs.set("event_name", params.event_name);
        if (params.contract_hash) qs.set("contract_hash", params.contract_hash);
        if (params.limit) qs.set("limit", String(params.limit));
        if (params.after_id) qs.set("after_id", params.after_id);
        return requestJSON(cfg, `/events-list?${qs.toString()}`, {
          method: "GET",
        });
      },
    },
    transactions: {
      async list(params) {
        const qs = new URLSearchParams();
        if (params.app_id) qs.set("app_id", params.app_id);
        if (params.limit) qs.set("limit", String(params.limit));
        if (params.after_id) qs.set("after_id", params.after_id);
        return requestJSON(cfg, `/transactions-list?${qs.toString()}`, {
          method: "GET",
        });
      },
    },
    privacy: {
      async getMerklePath(commitment) {
        if (!commitment || typeof commitment !== "string" || !commitment.trim())
          throw new Error("commitment is required");
        return requestJSON(
          cfg,
          `/privacy-merkle-path?commitment=${encodeURIComponent(commitment)}`,
          {
            method: "GET",
          },
        );
      },
      async relay(params) {
        return requestJSON(cfg, "/privacy-relay", {
          method: "POST",
          body: JSON.stringify(params),
        });
      },
    },
    gasSponsor: {
      async check() {
        return requestJSON(cfg, "/gas-sponsor-check", { method: "GET" });
      },
      async request(amount) {
        if (!amount || typeof amount !== "string" || !amount.trim())
          throw new Error("amount is required");
        return requestJSON(cfg, "/gas-sponsor-request", {
          method: "POST",
          body: JSON.stringify({ amount }),
        });
      },
    },
  };
}
export function createHostSDK(cfg) {
  const mini = createMiniAppSDK(cfg);
  return {
    ...mini,
    wallet: {
      ...mini.wallet,
      async getBindMessage() {
        return requestJSON(cfg, "/wallet-nonce", {
          method: "POST",
          body: JSON.stringify({}),
        });
      },
      async bindWallet(params) {
        return requestJSON(cfg, "/wallet-bind", {
          method: "POST",
          body: JSON.stringify({
            address: params.address,
            public_key: params.publicKey,
            signature: params.signature,
            message: params.message,
            nonce: params.nonce,
            label: params.label,
          }),
        });
      },
    },
    apps: {
      async register(params) {
        return requestJSON(cfg, "/app-register", {
          method: "POST",
          body: JSON.stringify({
            manifest: params.manifest,
          }),
        });
      },
      async updateManifest(params) {
        return requestJSON(cfg, "/app-update-manifest", {
          method: "POST",
          body: JSON.stringify({
            manifest: params.manifest,
          }),
        });
      },
    },
    oracle: {
      async query(params) {
        return requestHostJSON(cfg, "/oracle-query", {
          method: "POST",
          body: JSON.stringify(params),
        });
      },
    },
    compute: {
      async execute(params) {
        return requestHostJSON(cfg, "/compute-execute", {
          method: "POST",
          body: JSON.stringify(params),
        });
      },
      async listJobs() {
        return requestHostJSON(cfg, "/compute-jobs", { method: "GET" });
      },
      async getJob(id) {
        if (!id || typeof id !== "string" || !id.trim())
          throw new Error("id is required for getJob");
        return requestHostJSON(
          cfg,
          `/compute-job?id=${encodeURIComponent(id)}`,
          { method: "GET" },
        );
      },
    },
    automation: {
      async listTriggers() {
        return requestHostJSON(cfg, "/automation-triggers", { method: "GET" });
      },
      async createTrigger(params) {
        return requestHostJSON(cfg, "/automation-triggers", {
          method: "POST",
          body: JSON.stringify(params),
        });
      },
      async getTrigger(id) {
        if (!id || typeof id !== "string" || !id.trim())
          throw new Error("id is required for getTrigger");
        return requestHostJSON(
          cfg,
          `/automation-trigger?id=${encodeURIComponent(id)}`,
          {
            method: "GET",
          },
        );
      },
      async updateTrigger(id, params) {
        return requestHostJSON(cfg, "/automation-trigger-update", {
          method: "POST",
          body: JSON.stringify({ id, ...params }),
        });
      },
      async deleteTrigger(id) {
        return requestHostJSON(cfg, "/automation-trigger-delete", {
          method: "POST",
          body: JSON.stringify({ id }),
        });
      },
      async enableTrigger(id) {
        return requestHostJSON(cfg, "/automation-trigger-enable", {
          method: "POST",
          body: JSON.stringify({ id }),
        });
      },
      async disableTrigger(id) {
        return requestHostJSON(cfg, "/automation-trigger-disable", {
          method: "POST",
          body: JSON.stringify({ id }),
        });
      },
      async resumeTrigger(id) {
        return requestHostJSON(cfg, "/automation-trigger-resume", {
          method: "POST",
          body: JSON.stringify({ id }),
        });
      },
      async listExecutions(id, limit) {
        const qs = new URLSearchParams({ id });
        if (typeof limit === "number" && Number.isFinite(limit))
          qs.set("limit", String(limit));
        return requestHostJSON(
          cfg,
          `/automation-trigger-executions?${qs.toString()}`,
          {
            method: "GET",
          },
        );
      },
    },
    secrets: {
      async list() {
        return requestHostJSON(cfg, "/secrets-list", { method: "GET" });
      },
      async get(name) {
        if (!name || typeof name !== "string" || !name.trim())
          throw new Error("name is required for secrets.get");
        return requestHostJSON(
          cfg,
          `/secrets-get?name=${encodeURIComponent(name)}`,
          {
            method: "GET",
          },
        );
      },
      async upsert(name, value) {
        return requestHostJSON(cfg, "/secrets-upsert", {
          method: "POST",
          body: JSON.stringify({ name, value }),
        });
      },
      async delete(name) {
        return requestHostJSON(cfg, "/secrets-delete", {
          method: "POST",
          body: JSON.stringify({ name }),
        });
      },
      async setPermissions(name, services) {
        return requestHostJSON(cfg, "/secrets-permissions", {
          method: "POST",
          body: JSON.stringify({ name, services }),
        });
      },
    },
    apiKeys: {
      async list() {
        return requestJSON(cfg, "/api-keys-list", { method: "GET" });
      },
      async create(params) {
        return requestJSON(cfg, "/api-keys-create", {
          method: "POST",
          body: JSON.stringify({
            name: params.name,
            scopes: params.scopes,
            description: params.description,
            expires_at: params.expires_at,
          }),
        });
      },
      async revoke(id) {
        return requestJSON(cfg, "/api-keys-revoke", {
          method: "POST",
          body: JSON.stringify({ id }),
        });
      },
    },
    gasbank: {
      async getAccount() {
        return requestJSON(cfg, "/gasbank-account", { method: "GET" });
      },
      async listDeposits() {
        return requestJSON(cfg, "/gasbank-deposits", { method: "GET" });
      },
      async createDeposit(params) {
        return requestJSON(cfg, "/gasbank-deposit", {
          method: "POST",
          body: JSON.stringify({
            amount: params.amount,
            from_address: params.from_address,
            tx_hash: params.tx_hash,
          }),
        });
      },
      async listTransactions() {
        return requestJSON(cfg, "/gasbank-transactions", { method: "GET" });
      },
    },
  };
}
