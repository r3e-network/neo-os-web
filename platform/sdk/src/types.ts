export type ContractParam =
  | { type: "String"; value: string }
  | { type: "Integer"; value: string }
  | { type: "Boolean"; value: boolean }
  | { type: "ByteArray"; value: string }
  | { type: "Hash160"; value: string }
  | { type: "Hash256"; value: string }
  | { type: "PublicKey"; value: string }
  | { type: "Any"; value: null }
  | { type: "Array"; value: ContractParam[] };

export type ChainType = "neo-n3" | "evm";
export type ChainId = string;

export type NeoInvocationIntent = {
  chain_id: ChainId;
  chain_type: "neo-n3";
  contract_address: string;
  method: string;
  params: ContractParam[];
};

export type EVMInvocationIntent = {
  chain_id: ChainId;
  chain_type: "evm";
  contract_address: string;
  data: string;
  value?: string;
  gas?: string;
  gas_price?: string;
  method?: string;
  args?: unknown[];
};

export type InvocationIntent = NeoInvocationIntent | EVMInvocationIntent;

// Wallet invocation result shape varies by wallet implementation (NeoLine/O3/etc).
export type TxResult = unknown;

export type IntentWithTx<TIntent> = {
  intent: TIntent;
  tx: TxResult;
};

export type PayGASResponse = {
  request_id: string;
  user_id: string;
  intent: "payments";
  constraints: { settlement: "GAS_ONLY" | "NATIVE_TOKEN" };
  chain_id: ChainId;
  chain_type: ChainType;
  invocation: InvocationIntent;
};

export type VoteBNEOResponse = {
  request_id: string;
  user_id: string;
  intent: "governance";
  constraints: { governance: "BNEO_ONLY" };
  chain_id: ChainId;
  chain_type: ChainType;
  invocation: InvocationIntent;
};

// Backwards-compatible alias for older docs/examples.
export type VoteNEOResponse = VoteBNEOResponse;

export type RNGResponse = {
  request_id: string;
  app_id: string;
  chain_id: ChainId;
  chain_type: ChainType;
  randomness: string;
  signature?: string;
  public_key?: string;
  attestation_hash?: string;
  anchored_tx?: unknown;
};

export type AppRegisterResponse = {
  request_id: string;
  user_id: string;
  intent: "apps";
  manifest_hash?: string;
  chain_id: ChainId;
  chain_type: ChainType;
  invocation: InvocationIntent;
};

export type AppUpdateManifestResponse = {
  request_id: string;
  user_id: string;
  intent: "apps";
  manifest_hash?: string;
  chain_id: ChainId;
  chain_type: ChainType;
  invocation: InvocationIntent;
};

export type WalletNonceResponse = {
  nonce: string;
  message: string;
};

export type WalletBindResponse = {
  wallet: {
    id: string;
    address: string;
    label?: string | null;
    is_primary: boolean;
    verified: boolean;
    created_at: string;
  };
};

export type SecretMeta = {
  id: string;
  name: string;
  version: number;
  created_at: string;
  updated_at: string;
};

export type SecretsListResponse = { secrets: SecretMeta[] };
export type SecretsGetResponse = { name: string; value: string; version: number };
export type SecretsUpsertResponse = { secret: SecretMeta; created: boolean };
export type SecretsDeleteResponse = { status: "ok" };
export type SecretsPermissionsResponse = { status: "ok"; services: string[] };

export type APIKeyMeta = {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  description?: string | null;
  created_at: string;
  last_used?: string | null;
  expires_at?: string | null;
  revoked?: boolean | null;
};

export type APIKeysListResponse = { api_keys: APIKeyMeta[] };
export type APIKeyCreateResponse = { api_key: APIKeyMeta & { key: string } };
export type APIKeyRevokeResponse = { status: "ok" };

// Note: Balance fields are serialized as strings from Go to avoid JS Number precision loss.
export type GasBankAccount = {
  id: string;
  user_id: string;
  balance: string;
  reserved: string;
  available: string;
  created_at: string;
  updated_at: string;
};

export type GasBankDepositStatus = "pending" | "confirming" | "confirmed" | "failed" | "expired";

export type GasBankDeposit = {
  id: string;
  amount: string;
  tx_hash?: string;
  from_address: string;
  status: GasBankDepositStatus;
  confirmations: number;
  created_at: string;
  confirmed_at?: string;
};

export type GasBankTransactionType = "deposit" | "withdraw" | "service_fee" | "refund";

export type GasBankTransaction = {
  id: string;
  tx_type: GasBankTransactionType;
  amount: string;
  balance_after: string;
  reference_id?: string;
  created_at: string;
};

export type GasBankAccountResponse = { account: GasBankAccount };
export type GasBankDepositsResponse = { deposits: GasBankDeposit[] };
export type GasBankTransactionsResponse = { transactions: GasBankTransaction[] };
export type GasBankDepositCreateResponse = { deposit: GasBankDeposit };

// Note: Price is serialized as string from Go to avoid JS Number precision loss.
export type PriceResponse = {
  feed_id: string;
  pair: string;
  price: string;
  decimals: number;
  timestamp: string;
  sources: string[];
  signature?: string;
  public_key?: string;
};

export type OracleQueryRequest = {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  secret_name?: string;
  secret_as_key?: string;
  body?: string;
};

export type OracleQueryResponse = {
  status_code: number;
  headers: Record<string, string>;
  body: string;
};

export type ComputeExecuteRequest = {
  script: string;
  entry_point?: string;
  input?: Record<string, unknown>;
  secret_refs?: string[];
  timeout?: number;
};

export type ComputeJob = {
  job_id: string;
  status: string;
  output?: Record<string, unknown>;
  logs?: string[];
  error?: string;
  gas_used: number;
  started_at: string;
  duration?: string;
  encrypted_output?: string;
  output_hash?: string;
  signature?: string;
};

/**
 * Verified compute request - executes script with on-chain hash verification.
 */
export type ComputeVerifiedRequest = {
  app_id: string;
  contract_hash: string;
  script_name: string;
  seed: string;
  input?: Record<string, unknown>;
  chain_id?: string;
};

/**
 * Verified compute response - includes script verification info.
 */
export type ComputeVerifiedResponse = {
  success: boolean;
  result: Record<string, unknown>;
  verification: {
    script_name: string;
    script_hash: string;
    script_version?: number;
    verified: boolean;
  };
};

// Automation Types (PostgreSQL-based)
export type AutomationTaskType = "scheduled" | "conditional" | "subscription";
export type AutomationTaskStatus = "active" | "paused" | "completed" | "failed";

export type AutomationTask = {
  id: string;
  app_id: string;
  task_type: AutomationTaskType;
  task_name: string;
  payload: Record<string, unknown>;
  status: AutomationTaskStatus;
  created_at: string;
  updated_at: string;
};

export type AutomationSchedule = {
  id: string;
  task_id: string;
  cron_expression?: string;
  interval_seconds?: number;
  next_run_at?: string;
  last_run_at?: string;
  run_count: number;
  max_runs?: number;
};

export type AutomationLog = {
  id: string;
  task_id: string;
  status: string;
  result?: Record<string, unknown>;
  error?: string;
  duration_ms?: number;
  executed_at: string;
};

export type RegisterTaskRequest = {
  appId: string;
  taskName: string;
  taskType: AutomationTaskType;
  payload?: Record<string, unknown>;
  schedule?: {
    cron?: string;
    intervalSeconds?: number;
    maxRuns?: number;
  };
};

export type RegisterTaskResponse = {
  success: boolean;
  taskId?: string;
  error?: string;
};

// Usage
export type MiniAppUsage = {
  app_id: string;
  chain_id?: ChainId;
  usage_date: string;
  gas_used: string;
  governance_used: string;
  tx_count: number;
};

export type MiniAppUsageResponse = {
  usage: MiniAppUsage | MiniAppUsage[];
  date?: string;
};

// Events
export type ContractEvent = {
  id: string;
  tx_hash: string;
  chain_id: ChainId;
  block_index: number;
  contract_address: string;
  event_name: string;
  app_id?: string;
  state?: unknown;
  created_at: string;
};

export type EventsListParams = {
  app_id?: string;
  event_name?: string;
  chain_id?: ChainId;
  contract_address?: string;
  limit?: number;
  after_id?: string;
};

export type EventsListResponse = {
  events: ContractEvent[];
  has_more: boolean;
  last_id?: string;
};

// Transactions
export type ChainTransaction = {
  id: string;
  tx_hash?: string;
  request_id: string;
  from_service: string;
  tx_type: string;
  chain_id?: ChainId;
  contract_address: string;
  method_name: string;
  status: string;
  gas_consumed?: number;
  submitted_at: string;
  confirmed_at?: string;
};

export type TransactionsListParams = {
  app_id?: string;
  chain_id?: ChainId;
  limit?: number;
  after_id?: string;
};

export type TransactionsListResponse = {
  transactions: ChainTransaction[];
  has_more: boolean;
  last_id?: string;
};

export interface MiniAppSDK {
  // Blueprint-compatible convenience (alias of wallet.getAddress()).
  getAddress?: () => Promise<string>;
  wallet: {
    getAddress(): Promise<string>;
    // Optional: host-provided helper to submit a previously created invocation intent.
    invokeIntent?: (requestId: string) => Promise<unknown>;
    // Optional: directly invoke a returned invocation (wallet-dependent).
    invokeInvocation?: (invocation: InvocationIntent) => Promise<TxResult>;
  };
  payments: {
    payGAS(appId: string, amount: string, memo?: string): Promise<PayGASResponse>;
    // Convenience: create the intent via the gateway, then submit via the wallet.
    payGASAndInvoke?: (appId: string, amount: string, memo?: string) => Promise<IntentWithTx<PayGASResponse>>;
  };
  governance: {
    vote(appId: string, proposalId: string, bneoAmount: string, support?: boolean): Promise<VoteBNEOResponse>;
    // Convenience: create the intent via the gateway, then submit via the wallet.
    voteAndInvoke?: (
      appId: string,
      proposalId: string,
      bneoAmount: string,
      support?: boolean,
    ) => Promise<IntentWithTx<VoteBNEOResponse>>;
  };
  rng: {
    requestRandom(appId: string): Promise<RNGResponse>;
  };
  datafeed: {
    getPrice(symbol: string): Promise<PriceResponse>;
  };
  stats: {
    getMyUsage(appId?: string, date?: string): Promise<MiniAppUsage | MiniAppUsage[]>;
  };
  events: {
    list(params: EventsListParams): Promise<EventsListResponse>;
  };
  transactions: {
    list(params: TransactionsListParams): Promise<TransactionsListResponse>;
  };
}

// Host-only APIs (should not be exposed to untrusted MiniApps).
export interface HostSDK {
  wallet: MiniAppSDK["wallet"] & {
    getBindMessage(): Promise<WalletNonceResponse>;
    bindWallet(params: {
      address: string;
      publicKey: string;
      signature: string;
      message: string;
      nonce: string;
      label?: string;
    }): Promise<WalletBindResponse>;
  };
  apps: {
    register(params: { manifest: Record<string, unknown>; chain_id?: ChainId }): Promise<AppRegisterResponse>;
    updateManifest(params: { manifest: Record<string, unknown>; chain_id?: ChainId }): Promise<AppUpdateManifestResponse>;
  };
  oracle: {
    query(params: OracleQueryRequest): Promise<OracleQueryResponse>;
  };
  compute: {
    execute(params: ComputeExecuteRequest): Promise<ComputeJob>;
    executeVerified(params: ComputeVerifiedRequest): Promise<ComputeVerifiedResponse>;
    listJobs(): Promise<ComputeJob[]>;
    getJob(id: string): Promise<ComputeJob>;
  };
  automation: {
    register(request: RegisterTaskRequest): Promise<RegisterTaskResponse>;
    unregister(appId: string, taskName: string): Promise<{ success: boolean }>;
    list(appId?: string): Promise<{ tasks: AutomationTask[] }>;
    status(appId: string, taskName: string): Promise<{ task: AutomationTask | null }>;
    update(
      taskId: string,
      payload?: Record<string, unknown>,
      schedule?: { intervalSeconds?: number; cron?: string; maxRuns?: number },
    ): Promise<{ success: boolean }>;
    enable(taskId: string): Promise<{ success: boolean; status: string }>;
    disable(taskId: string): Promise<{ success: boolean; status: string }>;
    logs(taskId?: string, appId?: string, limit?: number): Promise<{ logs: AutomationLog[] }>;
  };
  secrets: {
    list(): Promise<SecretsListResponse>;
    get(name: string): Promise<SecretsGetResponse>;
    upsert(name: string, value: string): Promise<SecretsUpsertResponse>;
    delete(name: string): Promise<SecretsDeleteResponse>;
    setPermissions(name: string, services: string[]): Promise<SecretsPermissionsResponse>;
  };
  apiKeys: {
    list(): Promise<APIKeysListResponse>;
    create(params: {
      name: string;
      scopes?: string[];
      description?: string;
      expires_at?: string;
    }): Promise<APIKeyCreateResponse>;
    revoke(id: string): Promise<APIKeyRevokeResponse>;
  };
  gasbank: {
    getAccount(): Promise<GasBankAccountResponse>;
    listDeposits(): Promise<GasBankDepositsResponse>;
    createDeposit(params: {
      amount: string;
      from_address: string;
      tx_hash?: string;
    }): Promise<GasBankDepositCreateResponse>;
    listTransactions(): Promise<GasBankTransactionsResponse>;
  };
  payments: MiniAppSDK["payments"];
  governance: MiniAppSDK["governance"];
  rng: MiniAppSDK["rng"];
  datafeed: MiniAppSDK["datafeed"];
  stats: MiniAppSDK["stats"];
  events: MiniAppSDK["events"];
  transactions: MiniAppSDK["transactions"];
}

export type MiniAppSDKConfig = {
  edgeBaseUrl: string;
  getAuthToken?: () => Promise<string | undefined>;
  getAPIKey?: () => Promise<string | undefined>;
  appId?: string;
  chainId?: ChainId | null;
  chainType?: ChainType;
};
