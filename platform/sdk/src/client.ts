import type {
  APIKeyCreateResponse,
  APIKeyRevokeResponse,
  APIKeysListResponse,
  AppRegisterResponse,
  AppUpdateManifestResponse,
  AutomationTask,
  AutomationLog,
  ChainId,
  ChainType,
  ContractParam,
  EVMInvocationIntent,
  RegisterTaskRequest,
  RegisterTaskResponse,
  EventsListParams,
  EventsListResponse,
  GasBankAccountResponse,
  GasBankDepositCreateResponse,
  GasBankDepositsResponse,
  GasBankTransactionsResponse,
  HostSDK,
  InvocationIntent,
  MiniAppSDK,
  MiniAppSDKConfig,
  MiniAppUsageResponse,
  NeoInvocationIntent,
  ComputeExecuteRequest,
  ComputeVerifiedRequest,
  ComputeVerifiedResponse,
  ComputeJob,
  OracleQueryRequest,
  OracleQueryResponse,
  PayGASResponse,
  PriceResponse,
  RNGResponse,
  SecretsDeleteResponse,
  SecretsGetResponse,
  SecretsListResponse,
  SecretsPermissionsResponse,
  SecretsUpsertResponse,
  TransactionsListParams,
  TransactionsListResponse,
  VoteBNEOResponse,
  WalletBindResponse,
  WalletNonceResponse,
} from "./types.js";

/** NeoLine N3 wallet interface */
interface NeoLineN3Wallet {
  Init: new () => NeoLineN3Instance;
}

interface NeoLineN3Instance {
  getAccount: () => Promise<{ address?: string; account?: { address?: string } }>;
  invoke: (params: NeoLineInvokeParams) => Promise<unknown>;
}

interface NeoLineInvokeParams {
  scriptHash: string;
  operation: string;
  args: unknown[];
  signers?: Array<{ account: string; scopes: string | number }>;
}

/** Extended window with NeoLine */
interface WindowWithNeoLine extends Window {
  NEOLineN3?: NeoLineN3Wallet;
  [key: string]: unknown;
}

interface EthereumProvider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
}

interface WindowWithEthereum extends Window {
  ethereum?: EthereumProvider;
}

async function getInjectedWalletAddress(chainType: ChainType): Promise<string> {
  if (typeof window === "undefined") {
    throw new Error("wallet.getAddress must be called in a browser context");
  }

  if (chainType === "evm") {
    const w = window as unknown as WindowWithEthereum;
    const provider = w.ethereum;
    if (!provider) {
      throw new Error("evm wallet not detected (install MetaMask or compatible wallet)");
    }
    const accounts = (await provider.request({ method: "eth_requestAccounts" })) as string[];
    const address = String(accounts?.[0] ?? "").trim();
    if (!address) throw new Error("evm wallet address not available");
    return address;
  }

  const g = window as unknown as WindowWithNeoLine;

  // NeoLine N3 (common browser wallet).
  const neoline = g?.NEOLineN3;
  if (neoline && typeof neoline.Init === "function") {
    const inst = new neoline.Init();
    if (inst && typeof inst.getAccount === "function") {
      const res = await inst.getAccount();
      const addr = String(res?.address ?? res?.account?.address ?? "").trim();
      if (addr) return addr;
    }
  }

  throw new Error("neo wallet not detected (install NeoLine N3) or host must bridge wallet.getAddress");
}

function getNeoLineN3Instance(): NeoLineN3Instance {
  if (typeof window === "undefined") {
    throw new Error("wallet invocation must be called in a browser context");
  }

  const g = window as unknown as WindowWithNeoLine;
  const neoline = g?.NEOLineN3;
  if (!neoline || typeof neoline.Init !== "function") {
    throw new Error("NeoLine N3 not detected (install the NeoLine extension)");
  }

  return new neoline.Init();
}

function getEvmProvider(): EthereumProvider {
  if (typeof window === "undefined") {
    throw new Error("wallet invocation must be called in a browser context");
  }
  const w = window as unknown as WindowWithEthereum;
  if (!w.ethereum) {
    throw new Error("evm wallet not detected (install MetaMask or compatible wallet)");
  }
  return w.ethereum;
}

function inferChainType(chainId?: string | null): ChainType {
  if (!chainId) return "neo-n3";
  if (chainId.startsWith("neo-n3")) return "neo-n3";
  return "evm";
}

function toHexQuantity(value?: string): string | undefined {
  if (!value) return undefined;
  const raw = String(value).trim();
  if (!raw) return undefined;
  if (raw.startsWith("0x")) return raw;
  const parsed = BigInt(raw);
  return `0x${parsed.toString(16)}`;
}

// Resolve SENDER placeholder in invocation params with the user's wallet address.
// This is used for GAS.Transfer where the 'from' parameter must be the user's address.
function resolveInvocationParams(params: ContractParam[], userAddress: string): ContractParam[] {
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

async function invokeNeoLineInvocation(invocation: InvocationIntent): Promise<unknown> {
  if (invocation.chain_type && invocation.chain_type !== "neo-n3") {
    throw new Error("invocation is not a neo-n3 intent");
  }
  const neoInvocation = invocation as NeoInvocationIntent;
  const inst = getNeoLineN3Instance();
  if (!inst || typeof inst.invoke !== "function") {
    throw new Error("wallet does not support invoke (NeoLine N3 required)");
  }

  const scriptHash = String(neoInvocation.contract_address ?? "").trim();
  const operation = String(neoInvocation.method ?? "").trim();

  if (!scriptHash) throw new Error("invocation missing contract_address");
  if (!operation) throw new Error("invocation missing method");

  // Get user's wallet address for SENDER placeholder resolution and signing
  const address = await getInjectedWalletAddress("neo-n3");

  // Resolve SENDER placeholders in params with the user's actual address
  const rawArgs = Array.isArray(neoInvocation.params) ? neoInvocation.params : [];
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

  let lastErr: unknown = null;
  for (const params of candidates) {
    try {
      return await inst.invoke(params);
    } catch (err) {
      lastErr = err;
    }
  }

  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr ?? "invoke failed"));
}

async function invokeEvmInvocation(invocation: InvocationIntent): Promise<unknown> {
  if (invocation.chain_type && invocation.chain_type !== "evm") {
    throw new Error("invocation is not an evm intent");
  }
  const evmInvocation = invocation as EVMInvocationIntent;
  const provider = getEvmProvider();
  const from = await getInjectedWalletAddress("evm");

  const to = String(evmInvocation.contract_address ?? "").trim();
  const data = String(evmInvocation.data ?? "").trim();
  if (!to) throw new Error("invocation missing contract_address");
  if (!data) throw new Error("invocation missing data");

  const tx = {
    from,
    to,
    data,
    value: toHexQuantity(evmInvocation.value),
    gas: toHexQuantity(evmInvocation.gas),
    gasPrice: toHexQuantity(evmInvocation.gas_price),
  };

  const txHash = (await provider.request({ method: "eth_sendTransaction", params: [tx] })) as string;
  return { tx_hash: txHash };
}

async function requestJSON<T>(cfg: MiniAppSDKConfig, path: string, init: RequestInit): Promise<T> {
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

  const resp = await fetch(url, { ...init, headers });
  const text = await resp.text();
  if (!resp.ok) throw new Error(text || `request failed (${resp.status})`);
  return JSON.parse(text) as T;
}

async function requestHostJSON<T>(cfg: MiniAppSDKConfig, path: string, init: RequestInit): Promise<T> {
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
  if (!resp.ok) throw new Error(text || `request failed (${resp.status})`);
  return JSON.parse(text) as T;
}

export function createMiniAppSDK(cfg: MiniAppSDKConfig): MiniAppSDK {
  const pendingInvocations = new Map<string, InvocationIntent>();
  const resolvedChainId = cfg.chainId ?? null;
  const fallbackChainType = cfg.chainType ?? inferChainType(resolvedChainId);

  const resolveInvocationChainType = (invocation?: InvocationIntent): ChainType => {
    if (invocation?.chain_type) return invocation.chain_type;
    return fallbackChainType;
  };

  const invokeWithWallet = async (invocation: InvocationIntent): Promise<unknown> => {
    const chainType = resolveInvocationChainType(invocation);
    if (chainType === "evm") {
      return invokeEvmInvocation(invocation);
    }
    return invokeNeoLineInvocation(invocation);
  };

  return {
    async getAddress() {
      return getInjectedWalletAddress(fallbackChainType);
    },
    wallet: {
      async getAddress() {
        return getInjectedWalletAddress(fallbackChainType);
      },
      async invokeIntent(requestId: string): Promise<unknown> {
        const id = String(requestId ?? "").trim();
        if (!id) throw new Error("request_id required");
        const invocation = pendingInvocations.get(id);
        if (!invocation) throw new Error("unknown request_id (no pending invocation)");
        pendingInvocations.delete(id);
        return invokeWithWallet(invocation);
      },
      async invokeInvocation(invocation: InvocationIntent): Promise<unknown> {
        return invokeWithWallet(invocation);
      },
    },
    payments: {
      async payGAS(appId: string, amount: string, memo?: string): Promise<PayGASResponse> {
        const res = await requestJSON<PayGASResponse>(cfg, "/pay-gas", {
          method: "POST",
          body: JSON.stringify({
            app_id: appId,
            amount_gas: amount,
            memo,
            chain_id: resolvedChainId ?? undefined,
          }),
        });
        try {
          pendingInvocations.set(res.request_id, res.invocation);
        } catch {
          // ignore
        }
        return res;
      },
      async payGASAndInvoke(appId: string, amount: string, memo?: string) {
        const intent = await this.payGAS(appId, amount, memo);
        const tx = await invokeWithWallet(intent.invocation);
        return { intent, tx };
      },
    },
    governance: {
      async vote(appId: string, proposalId: string, bneoAmount: string, support?: boolean): Promise<VoteBNEOResponse> {
        const res = await requestJSON<VoteBNEOResponse>(cfg, "/vote-bneo", {
          method: "POST",
          body: JSON.stringify({
            app_id: appId,
            proposal_id: proposalId,
            bneo_amount: bneoAmount,
            support,
            chain_id: resolvedChainId ?? undefined,
          }),
        });
        try {
          pendingInvocations.set(res.request_id, res.invocation);
        } catch {
          // ignore
        }
        return res;
      },
      async voteAndInvoke(appId: string, proposalId: string, bneoAmount: string, support?: boolean) {
        const intent = await this.vote(appId, proposalId, bneoAmount, support);
        const tx = await invokeWithWallet(intent.invocation);
        return { intent, tx };
      },
    },
    rng: {
      async requestRandom(appId: string): Promise<RNGResponse> {
        return requestJSON<RNGResponse>(cfg, "/rng-request", {
          method: "POST",
          body: JSON.stringify({ app_id: appId, chain_id: resolvedChainId ?? undefined }),
        });
      },
    },
    datafeed: {
      async getPrice(symbol: string): Promise<PriceResponse> {
        return requestJSON<PriceResponse>(cfg, `/datafeed-price?symbol=${encodeURIComponent(symbol)}`, {
          method: "GET",
        });
      },
    },
    stats: {
      async getMyUsage(appId?: string, date?: string) {
        const resolvedAppId = String(appId ?? cfg.appId ?? "").trim();
        const qs = new URLSearchParams();
        if (resolvedAppId) qs.set("app_id", resolvedAppId);
        if (date) qs.set("date", date);
        if (resolvedChainId) qs.set("chain_id", resolvedChainId);
        const path = qs.toString() ? `/miniapp-usage?${qs.toString()}` : "/miniapp-usage";
        const res = await requestJSON<MiniAppUsageResponse>(cfg, path, { method: "GET" });
        return res.usage;
      },
    },
    events: {
      async list(params: EventsListParams): Promise<EventsListResponse> {
        const qs = new URLSearchParams();
        if (params.app_id) qs.set("app_id", params.app_id);
        if (params.event_name) qs.set("event_name", params.event_name);
        const chainId = params.chain_id ?? resolvedChainId ?? undefined;
        if (chainId) qs.set("chain_id", chainId);
        if (params.contract_address) qs.set("contract_address", params.contract_address);
        if (params.contract_address) qs.set("contract_address", params.contract_address);
        if (params.limit) qs.set("limit", String(params.limit));
        if (params.after_id) qs.set("after_id", params.after_id);
        return requestJSON<EventsListResponse>(cfg, `/events-list?${qs.toString()}`, { method: "GET" });
      },
    },
    transactions: {
      async list(params: TransactionsListParams): Promise<TransactionsListResponse> {
        const qs = new URLSearchParams();
        if (params.app_id) qs.set("app_id", params.app_id);
        const chainId = params.chain_id ?? resolvedChainId ?? undefined;
        if (chainId) qs.set("chain_id", chainId);
        if (params.limit) qs.set("limit", String(params.limit));
        if (params.after_id) qs.set("after_id", params.after_id);
        return requestJSON<TransactionsListResponse>(cfg, `/transactions-list?${qs.toString()}`, { method: "GET" });
      },
    },
  };
}

export function createHostSDK(cfg: MiniAppSDKConfig): HostSDK {
  const mini = createMiniAppSDK(cfg);
  const resolvedChainId = cfg.chainId ?? null;

  return {
    ...mini,
    wallet: {
      ...mini.wallet,
      async getBindMessage(): Promise<WalletNonceResponse> {
        return requestJSON<WalletNonceResponse>(cfg, "/wallet-nonce", {
          method: "POST",
          body: JSON.stringify({}),
        });
      },
      async bindWallet(params): Promise<WalletBindResponse> {
        return requestJSON<WalletBindResponse>(cfg, "/wallet-bind", {
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
      async register(params): Promise<AppRegisterResponse> {
        return requestJSON<AppRegisterResponse>(cfg, "/app-register", {
          method: "POST",
          body: JSON.stringify({
            manifest: params.manifest,
            chain_id: params.chain_id ?? resolvedChainId ?? undefined,
          }),
        });
      },
      async updateManifest(params): Promise<AppUpdateManifestResponse> {
        return requestJSON<AppUpdateManifestResponse>(cfg, "/app-update-manifest", {
          method: "POST",
          body: JSON.stringify({
            manifest: params.manifest,
            chain_id: params.chain_id ?? resolvedChainId ?? undefined,
          }),
        });
      },
    },
    oracle: {
      async query(params: OracleQueryRequest): Promise<OracleQueryResponse> {
        return requestHostJSON<OracleQueryResponse>(cfg, "/oracle-query", {
          method: "POST",
          body: JSON.stringify(params),
        });
      },
    },
    compute: {
      async execute(params: ComputeExecuteRequest): Promise<ComputeJob> {
        return requestHostJSON<ComputeJob>(cfg, "/compute-execute", {
          method: "POST",
          body: JSON.stringify(params),
        });
      },
      async executeVerified(params: ComputeVerifiedRequest): Promise<ComputeVerifiedResponse> {
        return requestHostJSON<ComputeVerifiedResponse>(cfg, "/compute-verified", {
          method: "POST",
          body: JSON.stringify(params),
        });
      },
      async listJobs(): Promise<ComputeJob[]> {
        return requestHostJSON<ComputeJob[]>(cfg, "/compute-jobs", { method: "GET" });
      },
      async getJob(id: string): Promise<ComputeJob> {
        return requestHostJSON<ComputeJob>(cfg, `/compute-job?id=${encodeURIComponent(id)}`, { method: "GET" });
      },
    },
    automation: {
      // === New PostgreSQL-based API (recommended) ===
      async register(request: RegisterTaskRequest): Promise<RegisterTaskResponse> {
        return requestHostJSON<RegisterTaskResponse>(cfg, "/api/automation/register", {
          method: "POST",
          body: JSON.stringify(request),
        });
      },
      async unregister(appId: string, taskName: string): Promise<{ success: boolean }> {
        return requestHostJSON<{ success: boolean }>(cfg, "/api/automation/unregister", {
          method: "POST",
          body: JSON.stringify({ appId, taskName }),
        });
      },
      async list(appId?: string): Promise<{ tasks: AutomationTask[] }> {
        const url = appId ? `/api/automation/list?appId=${encodeURIComponent(appId)}` : "/api/automation/list";
        return requestHostJSON<{ tasks: AutomationTask[] }>(cfg, url, { method: "GET" });
      },
      async status(appId: string, taskName: string): Promise<{ task: AutomationTask | null }> {
        return requestHostJSON<{ task: AutomationTask | null }>(
          cfg,
          `/api/automation/status?appId=${encodeURIComponent(appId)}&taskName=${encodeURIComponent(taskName)}`,
          { method: "GET" },
        );
      },
      async update(
        taskId: string,
        payload?: Record<string, unknown>,
        schedule?: { intervalSeconds?: number; cron?: string; maxRuns?: number },
      ): Promise<{ success: boolean }> {
        return requestHostJSON<{ success: boolean }>(cfg, "/api/automation/update", {
          method: "PUT",
          body: JSON.stringify({ taskId, payload, schedule }),
        });
      },
      async enable(taskId: string): Promise<{ success: boolean; status: string }> {
        return requestHostJSON<{ success: boolean; status: string }>(cfg, "/api/automation/enable", {
          method: "POST",
          body: JSON.stringify({ taskId }),
        });
      },
      async disable(taskId: string): Promise<{ success: boolean; status: string }> {
        return requestHostJSON<{ success: boolean; status: string }>(cfg, "/api/automation/disable", {
          method: "POST",
          body: JSON.stringify({ taskId }),
        });
      },
      async logs(taskId?: string, appId?: string, limit = 50): Promise<{ logs: AutomationLog[] }> {
        const qs = new URLSearchParams();
        if (taskId) qs.set("taskId", taskId);
        if (appId) qs.set("appId", appId);
        qs.set("limit", String(limit));
        return requestHostJSON<{ logs: AutomationLog[] }>(cfg, `/api/automation/logs?${qs.toString()}`, {
          method: "GET",
        });
      },
    },
    secrets: {
      async list(): Promise<SecretsListResponse> {
        return requestHostJSON<SecretsListResponse>(cfg, "/secrets-list", { method: "GET" });
      },
      async get(name: string): Promise<SecretsGetResponse> {
        return requestHostJSON<SecretsGetResponse>(cfg, `/secrets-get?name=${encodeURIComponent(name)}`, {
          method: "GET",
        });
      },
      async upsert(name: string, value: string): Promise<SecretsUpsertResponse> {
        return requestHostJSON<SecretsUpsertResponse>(cfg, "/secrets-upsert", {
          method: "POST",
          body: JSON.stringify({ name, value }),
        });
      },
      async delete(name: string): Promise<SecretsDeleteResponse> {
        return requestHostJSON<SecretsDeleteResponse>(cfg, "/secrets-delete", {
          method: "POST",
          body: JSON.stringify({ name }),
        });
      },
      async setPermissions(name: string, services: string[]): Promise<SecretsPermissionsResponse> {
        return requestHostJSON<SecretsPermissionsResponse>(cfg, "/secrets-permissions", {
          method: "POST",
          body: JSON.stringify({ name, services }),
        });
      },
    },
    apiKeys: {
      async list(): Promise<APIKeysListResponse> {
        return requestJSON<APIKeysListResponse>(cfg, "/api-keys-list", { method: "GET" });
      },
      async create(params): Promise<APIKeyCreateResponse> {
        return requestJSON<APIKeyCreateResponse>(cfg, "/api-keys-create", {
          method: "POST",
          body: JSON.stringify({
            name: params.name,
            scopes: params.scopes,
            description: params.description,
            expires_at: params.expires_at,
          }),
        });
      },
      async revoke(id: string): Promise<APIKeyRevokeResponse> {
        return requestJSON<APIKeyRevokeResponse>(cfg, "/api-keys-revoke", {
          method: "POST",
          body: JSON.stringify({ id }),
        });
      },
    },
    gasbank: {
      async getAccount(): Promise<GasBankAccountResponse> {
        return requestJSON<GasBankAccountResponse>(cfg, "/gasbank-account", { method: "GET" });
      },
      async listDeposits(): Promise<GasBankDepositsResponse> {
        return requestJSON<GasBankDepositsResponse>(cfg, "/gasbank-deposits", { method: "GET" });
      },
      async createDeposit(params): Promise<GasBankDepositCreateResponse> {
        return requestJSON<GasBankDepositCreateResponse>(cfg, "/gasbank-deposit", {
          method: "POST",
          body: JSON.stringify({
            amount: params.amount,
            from_address: params.from_address,
            tx_hash: params.tx_hash,
          }),
        });
      },
      async listTransactions(): Promise<GasBankTransactionsResponse> {
        return requestJSON<GasBankTransactionsResponse>(cfg, "/gasbank-transactions", { method: "GET" });
      },
    },
  };
}
