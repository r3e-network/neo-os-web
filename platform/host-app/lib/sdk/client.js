async function getInjectedWalletAddress() {
    if (typeof window === "undefined") {
        throw new Error("wallet.getAddress must be called in a browser context");
    }
    const g = window;
    // NeoLine N3 (common browser wallet).
    const neoline = g?.NEOLineN3;
    if (neoline && typeof neoline.Init === "function") {
        const inst = new neoline.Init();
        if (inst && typeof inst.getAccount === "function") {
            const res = await inst.getAccount();
            const addr = String(res?.address ?? res?.account?.address ?? "").trim();
            if (addr)
                return addr;
        }
    }
    throw new Error("neo wallet not detected (install NeoLine N3) or host must bridge wallet.getAddress");
}
function getNeoLineN3Instance() {
    if (typeof window === "undefined") {
        throw new Error("wallet invocation must be called in a browser context");
    }
    const g = window;
    const neoline = g?.NEOLineN3;
    if (!neoline || typeof neoline.Init !== "function") {
        throw new Error("NeoLine N3 not detected (install the NeoLine extension)");
    }
    return new neoline.Init();
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
async function invokeNeoLineInvocation(invocation) {
    const inst = getNeoLineN3Instance();
    if (!inst || typeof inst.invoke !== "function") {
        throw new Error("wallet does not support invoke (NeoLine N3 required)");
    }
    const scriptHash = String(invocation.contract_hash ?? "").trim();
    const operation = String(invocation.method ?? "").trim();
    if (!scriptHash)
        throw new Error("invocation missing contract_hash");
    if (!operation)
        throw new Error("invocation missing method");
    // Get user's wallet address for SENDER placeholder resolution and signing
    const address = await getInjectedWalletAddress();
    // Resolve SENDER placeholders in params with the user's actual address
    const rawArgs = Array.isArray(invocation.params) ? invocation.params : [];
    const args = resolveInvocationParams(rawArgs, address);
    // NeoLine SDKs vary slightly in accepted shapes; try a small set of candidates.
    // SECURITY: Use CalledByEntry scope by default (most restrictive).
    // Only fall back to Global scope if explicitly required by the contract.
    const candidates = [
        { scriptHash, operation, args, signers: [{ account: address, scopes: "CalledByEntry" }] },
        {
            scriptHash: scriptHash.replace(/^0x/i, ""),
            operation,
            args,
            signers: [{ account: address, scopes: "CalledByEntry" }],
        },
        { scriptHash, operation, args, signers: [{ account: address, scopes: 1 }] },
        { scriptHash: scriptHash.replace(/^0x/i, ""), operation, args, signers: [{ account: address, scopes: 1 }] },
        { scriptHash, operation, args },
        { scriptHash: scriptHash.replace(/^0x/i, ""), operation, args },
    ];
    let lastErr = null;
    for (const params of candidates) {
        try {
            return await inst.invoke(params);
        }
        catch (err) {
            lastErr = err;
        }
    }
    throw lastErr instanceof Error ? lastErr : new Error(String(lastErr ?? "invoke failed"));
}
async function requestJSON(cfg, path, init) {
    const base = cfg.edgeBaseUrl.replace(/\/$/, "");
    const url = `${base}${path.startsWith("/") ? "" : "/"}${path}`;
    const headers = new Headers(init.headers);
    headers.set("Content-Type", "application/json");
    if (cfg.getAuthToken) {
        const token = await cfg.getAuthToken();
        if (token)
            headers.set("Authorization", `Bearer ${token}`);
    }
    if (!headers.get("Authorization") && cfg.getAPIKey) {
        const apiKey = await cfg.getAPIKey();
        if (apiKey)
            headers.set("X-API-Key", apiKey);
    }
    const resp = await fetch(url, { ...init, headers });
    const text = await resp.text();
    if (!resp.ok)
        throw new Error(text || `request failed (${resp.status})`);
    return JSON.parse(text);
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
    const resp = await fetch(url, { ...init, headers });
    const text = await resp.text();
    if (!resp.ok)
        throw new Error(text || `request failed (${resp.status})`);
    return JSON.parse(text);
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
            async invokeIntent(requestId) {
                const id = String(requestId ?? "").trim();
                if (!id)
                    throw new Error("request_id required");
                const invocation = pendingInvocations.get(id);
                if (!invocation)
                    throw new Error("unknown request_id (no pending invocation)");
                pendingInvocations.delete(id);
                return invokeNeoLineInvocation(invocation);
            },
            async invokeInvocation(invocation) {
                return invokeNeoLineInvocation(invocation);
            },
        },
        payments: {
            async payGAS(appId, amount, memo) {
                const res = await requestJSON(cfg, "/pay-gas", {
                    method: "POST",
                    body: JSON.stringify({ app_id: appId, amount_gas: amount, memo }),
                });
                try {
                    pendingInvocations.set(res.request_id, res.invocation);
                }
                catch {
                    // ignore
                }
                return res;
            },
            async payGASAndInvoke(appId, amount, memo) {
                const intent = await this.payGAS(appId, amount, memo);
                const tx = await invokeNeoLineInvocation(intent.invocation);
                return { intent, tx };
            },
        },
        governance: {
            async vote(appId, proposalId, neoAmount, support) {
                const res = await requestJSON(cfg, "/vote-neo", {
                    method: "POST",
                    body: JSON.stringify({
                        app_id: appId,
                        proposal_id: proposalId,
                        neo_amount: neoAmount,
                        support,
                    }),
                });
                try {
                    pendingInvocations.set(res.request_id, res.invocation);
                }
                catch {
                    // ignore
                }
                return res;
            },
            async voteAndInvoke(appId, proposalId, neoAmount, support) {
                const intent = await this.vote(appId, proposalId, neoAmount, support);
                const tx = await invokeNeoLineInvocation(intent.invocation);
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
                return requestJSON(cfg, `/datafeed-price?symbol=${encodeURIComponent(symbol)}`, {
                    method: "GET",
                });
            },
        },
        stats: {
            async getMyUsage(appId, date) {
                const resolvedAppId = String(appId ?? cfg.appId ?? "").trim();
                const qs = new URLSearchParams();
                if (resolvedAppId)
                    qs.set("app_id", resolvedAppId);
                if (date)
                    qs.set("date", date);
                const path = qs.toString() ? `/miniapp-usage?${qs.toString()}` : "/miniapp-usage";
                const res = await requestJSON(cfg, path, { method: "GET" });
                return res.usage;
            },
        },
        events: {
            async list(params) {
                const qs = new URLSearchParams();
                if (params.app_id)
                    qs.set("app_id", params.app_id);
                if (params.event_name)
                    qs.set("event_name", params.event_name);
                if (params.contract_hash)
                    qs.set("contract_hash", params.contract_hash);
                if (params.limit)
                    qs.set("limit", String(params.limit));
                if (params.after_id)
                    qs.set("after_id", params.after_id);
                return requestJSON(cfg, `/events-list?${qs.toString()}`, { method: "GET" });
            },
        },
        transactions: {
            async list(params) {
                const qs = new URLSearchParams();
                if (params.app_id)
                    qs.set("app_id", params.app_id);
                if (params.limit)
                    qs.set("limit", String(params.limit));
                if (params.after_id)
                    qs.set("after_id", params.after_id);
                return requestJSON(cfg, `/transactions-list?${qs.toString()}`, { method: "GET" });
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
                return requestHostJSON(cfg, `/compute-job?id=${encodeURIComponent(id)}`, { method: "GET" });
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
                return requestHostJSON(cfg, `/automation-trigger?id=${encodeURIComponent(id)}`, {
                    method: "GET",
                });
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
                return requestHostJSON(cfg, `/automation-trigger-executions?${qs.toString()}`, {
                    method: "GET",
                });
            },
        },
        secrets: {
            async list() {
                return requestHostJSON(cfg, "/secrets-list", { method: "GET" });
            },
            async get(name) {
                return requestHostJSON(cfg, `/secrets-get?name=${encodeURIComponent(name)}`, {
                    method: "GET",
                });
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
