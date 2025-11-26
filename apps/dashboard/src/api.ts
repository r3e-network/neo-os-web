export type Descriptor = {
  name: string;
  domain: string;
  layer: string;
  capabilities?: string[];
};

export type HealthCheck = {
  status: string;
  version?: string;
  // Legacy field; prefer fetchVersion for build metadata.
  commit?: string;
};

export type Account = {
  ID: string;
  Owner: string;
  Metadata?: Record<string, string>;
  CreatedAt?: string;
  UpdatedAt?: string;
};

export type WorkspaceWallet = {
  ID: string;
  WorkspaceID: string;
  WalletAddress: string;
  Label?: string;
  Status?: string;
  CreatedAt?: string;
  UpdatedAt?: string;
};

export type VRFKey = {
  ID: string;
  AccountID: string;
  PublicKey: string;
  Status?: string;
  WalletAddress?: string;
  Attestation?: string;
  Metadata?: Record<string, string>;
};

export type VRFRequest = {
  ID: string;
  AccountID: string;
  KeyID: string;
  Consumer: string;
  Seed: string;
  Status: string;
  Metadata?: Record<string, string>;
};

export type Lane = {
  ID: string;
  AccountID: string;
  Name: string;
  SourceChain: string;
  DestChain: string;
  SignerSet?: string[];
  AllowedTokens?: string[];
  Metadata?: Record<string, string>;
  Tags?: string[];
};

export type CCIPMessage = {
  ID: string;
  AccountID: string;
  LaneID: string;
  Status: string;
  Payload?: Record<string, any>;
  TokenTransfers?: { Token: string; Amount: string; Recipient: string }[];
  Metadata?: Record<string, string>;
  Tags?: string[];
};

export type Datafeed = {
  ID: string;
  AccountID: string;
  Pair: string;
  Decimals: number;
  Heartbeat?: number;
  ThresholdPPM?: number;
  SignerSet?: string[];
  Aggregation?: string;
  Metadata?: Record<string, string>;
  Tags?: string[];
  CreatedAt?: string;
  UpdatedAt?: string;
};

export type DatafeedUpdate = {
  ID: string;
  RoundID: number;
  Price: string;
  Signer?: string;
  Timestamp: string;
  Signature?: string;
  Status?: string;
  Error?: string;
  Metadata?: Record<string, string>;
};

export type DatalinkChannel = {
  ID: string;
  AccountID: string;
  Name: string;
  Endpoint: string;
  Status?: string;
  SignerSet?: string[];
  Metadata?: Record<string, string>;
  Tags?: string[];
};

export type DatalinkDelivery = {
  ID: string;
  AccountID: string;
  ChannelID: string;
  Status: string;
  Metadata?: Record<string, string>;
};

export type JamAccumulatorRoot = {
  root: string;
  height?: number;
  created_at?: string;
};

export type JamStatus = {
  enabled: boolean;
  store?: string;
  rate_limit_per_min?: number;
  max_preimage_bytes?: number;
  max_pending_packages?: number;
  auth_required?: boolean;
  legacy_list_response?: boolean;
  accumulators_enabled?: boolean;
  accumulator_hash?: string;
  accumulator_roots?: JamAccumulatorRoot[];
};

export type SystemStatus = {
  status?: string;
  version?: {
    version: string;
    commit: string;
    built_at: string;
    go_version: string;
  };
  services?: Descriptor[];
  jam?: JamStatus;
  neo?: NeoStatus | NeoStatusError;
  modules?: ModuleStatus[];
  modules_meta?: Record<string, number>;
  modules_timings?: Record<string, { start_ms?: number; stop_ms?: number }>;
  modules_uptime?: Record<string, number>;
  modules_slow?: string[];
  modules_slow_threshold_ms?: number;
  modules_summary?: {
    data?: string[];
    event?: string[];
    compute?: string[];
  };
  modules_api_meta?: Record<string, { total?: number; slow?: number }>;
  modules_api_summary?: Record<string, string[]>;
  modules_layers?: Record<string, string[]>;
  modules_waiting_deps?: string[];
  modules_waiting_reasons?: Record<string, string>;
  bus_fanout?: Record<string, { ok?: number; error?: number }>;
  bus_fanout_recent?: Record<string, { ok?: number; error?: number }>;
  bus_fanout_recent_window_seconds?: number;
};

export type ModuleStatus = {
  name: string;
  domain?: string;
  category?: string;
  layer?: string;
  interfaces?: string[];
  apis?: {
    name?: string;
    surface?: string;
    stability?: string;
    summary?: string;
  }[];
  permissions?: string[];
  depends_on?: string[];
  capabilities?: string[];
  quotas?: Record<string, string>;
  requires_apis?: string[];
  notes?: string[];
  status?: string;
  error?: string;
  ready_status?: string;
  ready_error?: string;
  started_at?: string;
  stopped_at?: string;
  updated_at?: string;
  start_nanos?: number;
  stop_nanos?: number;
};

export type AuditEntry = {
  time: string;
  user?: string;
  role?: string;
  tenant?: string;
  path: string;
  method: string;
  status: number;
  remote_addr?: string;
  user_agent?: string;
};

export type Datastream = {
  ID: string;
  AccountID: string;
  Name: string;
  Symbol: string;
  Frequency: string;
  SLAMs?: number;
  Status?: string;
  Metadata?: Record<string, string>;
};

export type DatastreamFrame = {
  ID: string;
  StreamID: string;
  Sequence: number;
  Payload: Record<string, any>;
  LatencyMs?: number;
  Status?: string;
};

export type PriceFeed = {
  ID: string;
  AccountID: string;
  BaseAsset: string;
  QuoteAsset: string;
  Pair: string;
  UpdateInterval: string;
  Heartbeat: string;
  DeviationPercent: number;
  Active: boolean;
  CreatedAt?: string;
  UpdatedAt?: string;
};

export type PriceSnapshot = {
  ID: string;
  FeedID: string;
  Price: number;
  Source?: string;
  CollectedAt?: string;
  CreatedAt?: string;
};

export type NeoStatus = {
  enabled: boolean;
  latest_height?: number;
  latest_hash?: string;
  latest_state_root?: string;
  stable_height?: number;
  stable_hash?: string;
  stable_state_root?: string;
  block_count?: number;
  tx_count?: number;
  snapshot_count?: number;
  last_indexed_at?: string;
  node_height?: number;
  node_lag?: number;
};

export type NeoStatusError = {
  enabled: boolean;
  error: string;
};

export type NeoBlock = {
  height: number;
  hash: string;
  state_root?: string;
  prev_hash?: string;
  next_hash?: string;
  block_time?: string;
  tx_count?: number;
};

export type NeoTransaction = {
  hash: string;
  ordinal: number;
  type?: string;
  sender?: string;
  net_fee?: number;
  sys_fee?: number;
  vm_state?: string;
  exception?: string;
};

export type NeoBlockDetail = {
  block: NeoBlock;
  transactions: NeoTransaction[];
};

export type NeoSnapshot = {
  network: string;
  height: number;
  state_root: string;
  generated_at: string;
  kv_path?: string;
  kv_url?: string;
  kv_sha256?: string;
  kv_bytes?: number;
  kv_diff_path?: string;
  kv_diff_url?: string;
  kv_diff_sha256?: string;
  kv_diff_bytes?: number;
  contracts?: string[];
  rpc_url?: string;
  signature?: string;
  signing_public_key?: string;
};

export type NeoStorage = {
  contract: string;
  kv: any;
};

export type NeoStorageDiff = {
  contract: string;
  kv_diff: any;
};

export type NeoStorageSummary = {
  contract: string;
  kv_entries: number;
  diff_entries?: number;
};

export type DTAProduct = {
  ID: string;
  AccountID: string;
  Name: string;
  Symbol: string;
  Type: string;
  Status?: string;
  SettlementTerms?: string;
};

export type DTAOrder = {
  ID: string;
  AccountID: string;
  ProductID: string;
  Type: string;
  Amount: string;
  WalletAddress: string;
  Status?: string;
  Metadata?: Record<string, string>;
};

export type GasAccount = {
  ID: string;
  AccountID: string;
  WalletAddress: string;
  Available: number;
  Pending: number;
  Locked: number;
};

export type GasTransaction = {
  ID: string;
  AccountID: string;
  GasAccountID: string;
  Amount: number;
  Status: string;
  ToAddress: string;
  FromAddress: string;
  CreatedAt?: string;
  UpdatedAt?: string;
  Type?: string;
  Error?: string;
};

export type GasbankAccountSummary = {
  account: GasAccount;
  pending_withdrawals: number;
  pending_amount: number;
};

export type GasbankTransactionBrief = {
  id: string;
  type: string;
  amount: number;
  status: string;
  created_at: string;
  completed_at?: string;
  from_address?: string;
  to_address?: string;
  error?: string;
};

export type GasbankSummary = {
  accounts: GasbankAccountSummary[];
  pending_withdrawals: number;
  pending_amount: number;
  total_balance: number;
  total_available: number;
  total_locked: number;
  last_deposit?: GasbankTransactionBrief;
  last_withdrawal?: GasbankTransactionBrief;
  generated_at: string;
};

export type GasbankDeadLetter = {
  TransactionID: string;
  AccountID: string;
  Reason: string;
  LastError?: string;
  LastAttemptAt?: string;
  Retries: number;
  CreatedAt?: string;
  UpdatedAt?: string;
};

export type GasbankSettlementAttempt = {
  TransactionID: string;
  Attempt: number;
  StartedAt: string;
  CompletedAt?: string;
  Status?: string;
  Error?: string;
};

export type Enclave = {
  ID: string;
  AccountID: string;
  Name: string;
  Provider: string;
  Measurement: string;
  Status?: string;
};

export type CREExecutor = {
  ID: string;
  AccountID: string;
  Name: string;
  Type: string;
  Endpoint: string;
  Metadata?: Record<string, string>;
};

export type CREPlaybook = {
  ID: string;
  AccountID: string;
  Name: string;
  Description?: string;
  Tags?: string[];
};

export type CRERun = {
  ID: string;
  AccountID: string;
  PlaybookID: string;
  ExecutorID?: string;
  Status: string;
};

export type AutomationJob = {
  ID: string;
  AccountID: string;
  Name: string;
  Schedule: string;
  Enabled: boolean;
};

export type Secret = {
  ID: string;
  AccountID: string;
  Name: string;
  CreatedAt: string;
  UpdatedAt: string;
  Metadata?: Record<string, string>;
};

export type FunctionSummary = {
  ID: string;
  AccountID: string;
  Name: string;
  Runtime: string;
  Status?: string;
  CreatedAt?: string;
  UpdatedAt?: string;
};

export type FunctionExecution = {
  ID: string;
  FunctionID: string;
  AccountID: string;
  Status: string;
  StartedAt?: string;
  CompletedAt?: string;
  Error?: string;
};

export type OracleSource = {
  ID: string;
  AccountID: string;
  Name: string;
  URL: string;
  AuthType?: string;
  Status?: string;
};

export type OracleRequest = {
  ID: string;
  AccountID: string;
  DataSourceID: string;
  Status: string;
  Attempts?: number;
  Payload?: string;
  Result?: string;
  CreatedAt?: string;
  UpdatedAt?: string;
  CompletedAt?: string;
  Error?: string;
};

export type OracleRequestsPage = {
  items: OracleRequest[];
  nextCursor?: string;
};

export type RandomRequest = {
  AccountID: string;
  Length: number;
  Value: string;
  CreatedAt?: string;
  RequestID?: string;
  Counter: number;
  Signature: string;
  PublicKey?: string;
};

export type Trigger = {
  ID: string;
  AccountID: string;
  Type: string;
  Rule: string;
  FunctionID: string;
};

export type ClientConfig = {
  baseUrl: string;
  token: string;
  tenant?: string;
};

export function normaliseUrl(url: string) {
  const trimmed = url.trim().replace(/\/$/, "");
  if (!trimmed) return "";
  if (!/^https?:\/\//i.test(trimmed)) {
    return `http://${trimmed}`;
  }
  return trimmed;
}

export async function fetchJSON<T>(url: string, config: ClientConfig, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${config.token}`,
    ...(init?.headers as Record<string, string> | undefined),
  };
  if (config.tenant) {
    headers["X-Tenant-ID"] = config.tenant;
  }
  const resp = await fetch(url, { ...init, headers });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`${resp.status} ${resp.statusText}: ${text}`);
  }
  return resp.json() as Promise<T>;
}

export async function fetchDescriptors(config: ClientConfig): Promise<Descriptor[]> {
  const url = `${config.baseUrl}/system/descriptors`;
  return fetchJSON<Descriptor[]>(url, config);
}

export async function fetchHealth(config: ClientConfig): Promise<HealthCheck> {
  const url = `${config.baseUrl}/healthz`;
  return fetchJSON<HealthCheck>(url, config);
}

export type SystemVersion = {
  version: string;
  commit: string;
  built_at: string;
  go_version: string;
};

export async function fetchVersion(config: ClientConfig): Promise<SystemVersion> {
  const url = `${config.baseUrl}/system/version`;
  return fetchJSON<SystemVersion>(url, config);
}

export async function fetchSystemStatus(config: ClientConfig): Promise<SystemStatus> {
  const url = `${config.baseUrl}/system/status`;
  return fetchJSON<SystemStatus>(url, config);
}

export async function postBusEvent(config: ClientConfig, event: string, payload?: any): Promise<{ status: string }> {
  const url = `${config.baseUrl}/system/events`;
  return fetchJSON<{ status: string }>(url, config, {
    method: "POST",
    body: JSON.stringify({ event, payload }),
  });
}

export async function postBusData(config: ClientConfig, topic: string, payload?: any): Promise<{ status: string }> {
  const url = `${config.baseUrl}/system/data`;
  return fetchJSON<{ status: string }>(url, config, {
    method: "POST",
    body: JSON.stringify({ topic, payload }),
  });
}

export type ComputeResult = { module: string; result?: any; error?: string };
export async function postBusCompute(config: ClientConfig, payload: any): Promise<{ results: ComputeResult[]; error?: string }> {
  const url = `${config.baseUrl}/system/compute`;
  return fetchJSON<{ results: ComputeResult[]; error?: string }>(url, config, {
    method: "POST",
    body: JSON.stringify({ payload }),
  });
}

export async function fetchNeoBlocks(config: ClientConfig, limit = 10): Promise<NeoBlock[]> {
  const url = `${config.baseUrl}/neo/blocks?limit=${limit}`;
  return fetchJSON<NeoBlock[]>(url, config);
}

export async function fetchNeoSnapshots(config: ClientConfig, limit = 20): Promise<NeoSnapshot[]> {
  const url = `${config.baseUrl}/neo/snapshots?limit=${limit}`;
  return fetchJSON<NeoSnapshot[]>(url, config);
}

export async function fetchNeoBlockDetail(config: ClientConfig, height: number): Promise<NeoBlockDetail> {
  const url = `${config.baseUrl}/neo/blocks/${height}`;
  return fetchJSON<NeoBlockDetail>(url, config);
}

export async function fetchNeoStorage(config: ClientConfig, height: number): Promise<NeoStorage[]> {
  const url = `${config.baseUrl}/neo/storage/${height}`;
  return fetchJSON<NeoStorage[]>(url, config);
}

export async function fetchNeoStorageDiff(config: ClientConfig, height: number): Promise<NeoStorageDiff[]> {
  const url = `${config.baseUrl}/neo/storage-diff/${height}`;
  return fetchJSON<NeoStorageDiff[]>(url, config);
}

export async function fetchNeoStorageSummary(config: ClientConfig, height: number): Promise<NeoStorageSummary[]> {
  const url = `${config.baseUrl}/neo/storage-summary/${height}`;
  return fetchJSON<NeoStorageSummary[]>(url, config);
}

export type AuditQuery = {
  limit?: number;
  offset?: number;
  user?: string;
  role?: string;
  tenant?: string;
  method?: string;
  contains?: string;
  status?: number;
};

export async function fetchAudit(config: ClientConfig, query: AuditQuery = {}): Promise<AuditEntry[]> {
  const params = new URLSearchParams();
  params.set("limit", String(query.limit ?? 200));
  if (query.offset !== undefined) params.set("offset", String(query.offset));
  if (query.user) params.set("user", query.user);
  if (query.role) params.set("role", query.role);
  if (query.tenant) params.set("tenant", query.tenant);
  if (query.method) params.set("method", query.method);
  if (query.contains) params.set("contains", query.contains);
  if (typeof query.status === "number") params.set("status", String(query.status));
  const url = `${config.baseUrl}/admin/audit?${params.toString()}`;
  return fetchJSON<AuditEntry[]>(url, config);
}

export async function fetchAccounts(config: ClientConfig, limit = 50): Promise<Account[]> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (config.tenant) params.set("tenant", config.tenant);
  const url = `${config.baseUrl}/accounts?${params.toString()}`;
  return fetchJSON<Account[]>(url, config);
}

export async function fetchWorkspaceWallets(config: ClientConfig, accountID: string, limit = 50): Promise<WorkspaceWallet[]> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (config.tenant) params.set("tenant", config.tenant);
  const url = `${config.baseUrl}/accounts/${accountID}/workspace-wallets?${params.toString()}`;
  return fetchJSON<WorkspaceWallet[]>(url, config);
}

export async function fetchVRFKeys(config: ClientConfig, accountID: string, limit = 50): Promise<VRFKey[]> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (config.tenant) params.set("tenant", config.tenant);
  const url = `${config.baseUrl}/accounts/${accountID}/vrf/keys?${params.toString()}`;
  return fetchJSON<VRFKey[]>(url, config);
}

export async function fetchVRFRequests(config: ClientConfig, accountID: string, limit = 50): Promise<VRFRequest[]> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (config.tenant) params.set("tenant", config.tenant);
  const url = `${config.baseUrl}/accounts/${accountID}/vrf/requests?${params.toString()}`;
  return fetchJSON<VRFRequest[]>(url, config);
}

export async function fetchLanes(config: ClientConfig, accountID: string, limit = 50): Promise<Lane[]> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (config.tenant) params.set("tenant", config.tenant);
  const url = `${config.baseUrl}/accounts/${accountID}/ccip/lanes?${params.toString()}`;
  return fetchJSON<Lane[]>(url, config);
}

export async function fetchMessages(config: ClientConfig, accountID: string, limit = 50): Promise<CCIPMessage[]> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (config.tenant) params.set("tenant", config.tenant);
  const url = `${config.baseUrl}/accounts/${accountID}/ccip/messages?${params.toString()}`;
  return fetchJSON<CCIPMessage[]>(url, config);
}

export async function fetchDatafeeds(config: ClientConfig, accountID: string, limit = 50): Promise<Datafeed[]> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (config.tenant) params.set("tenant", config.tenant);
  const url = `${config.baseUrl}/accounts/${accountID}/datafeeds?${params.toString()}`;
  return fetchJSON<Datafeed[]>(url, config);
}

export async function updateDatafeedAggregation(
  config: ClientConfig,
  accountID: string,
  feed: Datafeed,
  aggregation: string,
): Promise<Datafeed> {
  const url = `${config.baseUrl}/accounts/${accountID}/datafeeds/${feed.ID}`;
  const payload = {
    pair: feed.Pair,
    description: (feed as any).Description || "",
    decimals: feed.Decimals,
    heartbeat_seconds: feed.Heartbeat ? Math.round(Number(feed.Heartbeat) / 1_000_000_000) : 0,
    threshold_ppm: feed.ThresholdPPM ?? 0,
    signer_set: feed.SignerSet ?? [],
    aggregation,
    metadata: feed.Metadata ?? {},
    tags: feed.Tags ?? [],
  };
  return fetchJSON<Datafeed>(url, config, { method: "PUT", body: JSON.stringify(payload) });
}

export async function fetchDatafeedUpdates(config: ClientConfig, accountID: string, feedID: string, limit = 20): Promise<DatafeedUpdate[]> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (config.tenant) params.set("tenant", config.tenant);
  const url = `${config.baseUrl}/accounts/${accountID}/datafeeds/${feedID}/updates?${params.toString()}`;
  return fetchJSON<DatafeedUpdate[]>(url, config);
}

export async function fetchDatalinkChannels(config: ClientConfig, accountID: string, limit = 50): Promise<DatalinkChannel[]> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (config.tenant) params.set("tenant", config.tenant);
  const url = `${config.baseUrl}/accounts/${accountID}/datalink/channels?${params.toString()}`;
  return fetchJSON<DatalinkChannel[]>(url, config);
}

export async function fetchDatalinkDeliveries(config: ClientConfig, accountID: string, limit = 50): Promise<DatalinkDelivery[]> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (config.tenant) params.set("tenant", config.tenant);
  const url = `${config.baseUrl}/accounts/${accountID}/datalink/deliveries?${params.toString()}`;
  return fetchJSON<DatalinkDelivery[]>(url, config);
}

export async function createDatalinkChannel(
  config: ClientConfig,
  accountID: string,
  payload: { name: string; endpoint: string; signers: string[]; status?: string; metadata?: Record<string, string> },
): Promise<DatalinkChannel> {
  const url = `${config.baseUrl}/accounts/${accountID}/datalink/channels`;
  const body = {
    name: payload.name,
    endpoint: payload.endpoint,
    signer_set: payload.signers,
    status: payload.status || "active",
    metadata: payload.metadata ?? {},
  };
  return fetchJSON<DatalinkChannel>(url, config, { method: "POST", body: JSON.stringify(body) });
}

export async function createDatalinkDelivery(
  config: ClientConfig,
  accountID: string,
  channelID: string,
  payload: { body: Record<string, any>; metadata?: Record<string, string> },
): Promise<DatalinkDelivery> {
  const url = `${config.baseUrl}/accounts/${accountID}/datalink/channels/${channelID}/deliveries`;
  const body = {
    payload: payload.body,
    metadata: payload.metadata ?? {},
  };
  return fetchJSON<DatalinkDelivery>(url, config, { method: "POST", body: JSON.stringify(body) });
}

export async function fetchDatastreams(config: ClientConfig, accountID: string, limit = 50): Promise<Datastream[]> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (config.tenant) params.set("tenant", config.tenant);
  const url = `${config.baseUrl}/accounts/${accountID}/datastreams?${params.toString()}`;
  return fetchJSON<Datastream[]>(url, config);
}

export async function fetchDatastreamFrames(config: ClientConfig, accountID: string, streamID: string, limit = 20): Promise<DatastreamFrame[]> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (config.tenant) params.set("tenant", config.tenant);
  const url = `${config.baseUrl}/accounts/${accountID}/datastreams/${streamID}/frames?${params.toString()}`;
  return fetchJSON<DatastreamFrame[]>(url, config);
}

export async function fetchPriceFeeds(config: ClientConfig, accountID: string): Promise<PriceFeed[]> {
  const params = new URLSearchParams();
  if (config.tenant) params.set("tenant", config.tenant);
  const suffix = params.toString() ? `?${params.toString()}` : "";
  const url = `${config.baseUrl}/accounts/${accountID}/pricefeeds${suffix}`;
  return fetchJSON<PriceFeed[]>(url, config);
}

export async function fetchPriceSnapshots(config: ClientConfig, accountID: string, feedID: string, limit = 5): Promise<PriceSnapshot[]> {
  const params = new URLSearchParams();
  if (config.tenant) params.set("tenant", config.tenant);
  const suffix = params.toString() ? `?${params.toString()}` : "";
  const url = `${config.baseUrl}/accounts/${accountID}/pricefeeds/${feedID}/snapshots${suffix}`;
  const snapshots = await fetchJSON<PriceSnapshot[]>(url, config);
  return snapshots.slice(0, limit);
}

export async function fetchDTAProducts(config: ClientConfig, accountID: string, limit = 50): Promise<DTAProduct[]> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (config.tenant) params.set("tenant", config.tenant);
  const url = `${config.baseUrl}/accounts/${accountID}/dta/products?${params.toString()}`;
  return fetchJSON<DTAProduct[]>(url, config);
}

export async function fetchDTAOrders(config: ClientConfig, accountID: string, limit = 50): Promise<DTAOrder[]> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (config.tenant) params.set("tenant", config.tenant);
  const url = `${config.baseUrl}/accounts/${accountID}/dta/orders?${params.toString()}`;
  return fetchJSON<DTAOrder[]>(url, config);
}

export async function fetchGasAccounts(config: ClientConfig, accountID: string, limit = 50): Promise<GasAccount[]> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (config.tenant) params.set("tenant", config.tenant);
  const url = `${config.baseUrl}/accounts/${accountID}/gasbank?${params.toString()}`;
  return fetchJSON<GasAccount[]>(url, config);
}

export async function fetchGasTransactions(config: ClientConfig, accountID: string, gasAccountID?: string, limit = 50): Promise<GasTransaction[]> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (gasAccountID) params.set("gas_account_id", gasAccountID);
  if (config.tenant) params.set("tenant", config.tenant);
  const url = `${config.baseUrl}/accounts/${accountID}/gasbank/transactions?${params.toString()}`;
  return fetchJSON<GasTransaction[]>(url, config);
}

export async function fetchGasbankSummary(config: ClientConfig, accountID: string): Promise<GasbankSummary> {
  const params = new URLSearchParams();
  if (config.tenant) params.set("tenant", config.tenant);
  const suffix = params.toString() ? `?${params.toString()}` : "";
  const url = `${config.baseUrl}/accounts/${accountID}/gasbank/summary${suffix}`;
  return fetchJSON<GasbankSummary>(url, config);
}

export async function fetchGasWithdrawals(
  config: ClientConfig,
  accountID: string,
  gasAccountID: string,
  status?: string,
  limit = 25,
): Promise<GasTransaction[]> {
  const params = new URLSearchParams({ gas_account_id: gasAccountID, limit: String(limit) });
  if (status) {
    params.set("status", status);
  }
  if (config.tenant) params.set("tenant", config.tenant);
  const url = `${config.baseUrl}/accounts/${accountID}/gasbank/withdrawals?${params.toString()}`;
  return fetchJSON<GasTransaction[]>(url, config);
}

export async function fetchGasDeadLetters(config: ClientConfig, accountID: string, limit = 25): Promise<GasbankDeadLetter[]> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (config.tenant) params.set("tenant", config.tenant);
  const url = `${config.baseUrl}/accounts/${accountID}/gasbank/deadletters?${params.toString()}`;
  return fetchJSON<GasbankDeadLetter[]>(url, config);
}

export async function fetchWithdrawalAttempts(
  config: ClientConfig,
  accountID: string,
  transactionID: string,
  limit = 10,
): Promise<GasbankSettlementAttempt[]> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (config.tenant) params.set("tenant", config.tenant);
  const url = `${config.baseUrl}/accounts/${accountID}/gasbank/withdrawals/${transactionID}/attempts?${params.toString()}`;
  return fetchJSON<GasbankSettlementAttempt[]>(url, config);
}

export async function fetchEnclaves(config: ClientConfig, accountID: string, limit = 50): Promise<Enclave[]> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (config.tenant) params.set("tenant", config.tenant);
  const url = `${config.baseUrl}/accounts/${accountID}/confcompute/enclaves?${params.toString()}`;
  return fetchJSON<Enclave[]>(url, config);
}

export async function fetchCREExecutors(config: ClientConfig, accountID: string, limit = 50): Promise<CREExecutor[]> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (config.tenant) params.set("tenant", config.tenant);
  const url = `${config.baseUrl}/accounts/${accountID}/cre/executors?${params.toString()}`;
  return fetchJSON<CREExecutor[]>(url, config);
}

export async function fetchCREPlaybooks(config: ClientConfig, accountID: string, limit = 50): Promise<CREPlaybook[]> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (config.tenant) params.set("tenant", config.tenant);
  const url = `${config.baseUrl}/accounts/${accountID}/cre/playbooks?${params.toString()}`;
  return fetchJSON<CREPlaybook[]>(url, config);
}

export async function fetchCRERuns(config: ClientConfig, accountID: string, limit = 50): Promise<CRERun[]> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (config.tenant) params.set("tenant", config.tenant);
  const url = `${config.baseUrl}/accounts/${accountID}/cre/runs?${params.toString()}`;
  return fetchJSON<CRERun[]>(url, config);
}

export async function fetchAutomationJobs(config: ClientConfig, accountID: string, limit = 50): Promise<AutomationJob[]> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (config.tenant) params.set("tenant", config.tenant);
  const url = `${config.baseUrl}/accounts/${accountID}/automation/jobs?${params.toString()}`;
  return fetchJSON<AutomationJob[]>(url, config);
}

export async function fetchTriggers(config: ClientConfig, accountID: string, limit = 50): Promise<Trigger[]> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (config.tenant) params.set("tenant", config.tenant);
  const url = `${config.baseUrl}/accounts/${accountID}/triggers?${params.toString()}`;
  return fetchJSON<Trigger[]>(url, config);
}

export async function fetchSecrets(config: ClientConfig, accountID: string, limit = 50): Promise<Secret[]> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (config.tenant) params.set("tenant", config.tenant);
  const url = `${config.baseUrl}/accounts/${accountID}/secrets?${params.toString()}`;
  return fetchJSON<Secret[]>(url, config);
}

export async function fetchFunctions(config: ClientConfig, accountID: string, limit = 50): Promise<FunctionSummary[]> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (config.tenant) params.set("tenant", config.tenant);
  const url = `${config.baseUrl}/accounts/${accountID}/functions?${params.toString()}`;
  return fetchJSON<FunctionSummary[]>(url, config);
}

export async function fetchFunctionExecutions(config: ClientConfig, accountID: string, functionID: string, limit = 20): Promise<FunctionExecution[]> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (config.tenant) params.set("tenant", config.tenant);
  const url = `${config.baseUrl}/accounts/${accountID}/functions/${functionID}/executions?${params.toString()}`;
  return fetchJSON<FunctionExecution[]>(url, config);
}

export async function fetchOracleSources(config: ClientConfig, accountID: string, limit = 50): Promise<OracleSource[]> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (config.tenant) params.set("tenant", config.tenant);
  const url = `${config.baseUrl}/accounts/${accountID}/oracle/sources?${params.toString()}`;
  return fetchJSON<OracleSource[]>(url, config);
}

export async function fetchOracleRequests(config: ClientConfig, accountID: string, limit = 100, status?: string, cursor?: string): Promise<OracleRequestsPage> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (status) {
    params.set("status", status);
  }
  if (cursor) {
    params.set("cursor", cursor);
  }
  if (config.tenant) params.set("tenant", config.tenant);
  const url = `${config.baseUrl}/accounts/${accountID}/oracle/requests?${params.toString()}`;
  const resp = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.token}`,
    },
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`${resp.status} ${resp.statusText}: ${text}`);
  }
  const items = (await resp.json()) as OracleRequest[];
  const nextCursor = resp.headers.get("X-Next-Cursor") || undefined;
  return { items, nextCursor };
}

export async function retryOracleRequest(config: ClientConfig, accountID: string, requestID: string): Promise<OracleRequest> {
  const url = `${config.baseUrl}/accounts/${accountID}/oracle/requests/${requestID}`;
  const resp = await fetch(url, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.token}`,
      ...(config.tenant ? { "X-Tenant-ID": config.tenant } : {}),
    },
    body: JSON.stringify({ status: "retry" }),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`${resp.status} ${resp.statusText}: ${text}`);
  }
  return (await resp.json()) as OracleRequest;
}

export async function fetchRandomRequests(config: ClientConfig, accountID: string, limit = 50): Promise<RandomRequest[]> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (config.tenant) params.set("tenant", config.tenant);
  const url = `${config.baseUrl}/accounts/${accountID}/random/requests?${params.toString()}`;
  return fetchJSON<RandomRequest[]>(url, config);
}

export async function jamUploadPreimage(config: ClientConfig, hash: string, data: ArrayBuffer, contentType: string) {
  const url = `${config.baseUrl}/jam/preimages/${hash}`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${config.token}`,
  };
  if (contentType) {
    headers["Content-Type"] = contentType;
  }
  const resp = await fetch(url, { method: "PUT", headers, body: new Blob([data], { type: contentType }) });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(text || `upload failed (${resp.status})`);
  }
}

export async function jamSubmitPackage(config: ClientConfig, payload: any) {
  const url = `${config.baseUrl}/jam/packages`;
  return fetchJSON<any>(url, config, { method: "POST", body: JSON.stringify(payload) });
}

// ============================================================================
// Admin Configuration API
// ============================================================================

export type ChainRPC = {
  id: string;
  chain_id: string;
  name: string;
  rpc_url: string;
  ws_url?: string;
  chain_type: string;
  network_id?: number;
  priority?: number;
  weight?: number;
  max_rps?: number;
  timeout_ms?: number;
  enabled: boolean;
  healthy: boolean;
  metadata?: Record<string, string>;
  created_at?: string;
  updated_at?: string;
  last_check_at?: string;
};

export type DataProvider = {
  id: string;
  name: string;
  type: string;
  base_url: string;
  api_key?: string;
  rate_limit?: number;
  timeout_ms?: number;
  retries?: number;
  enabled: boolean;
  healthy: boolean;
  features?: string[];
  metadata?: Record<string, string>;
  created_at?: string;
  updated_at?: string;
  last_check_at?: string;
};

export type SystemSetting = {
  key: string;
  value: string;
  type: string;
  category: string;
  description?: string;
  editable: boolean;
  updated_at?: string;
  updated_by?: string;
};

export type FeatureFlag = {
  key: string;
  enabled: boolean;
  description?: string;
  rollout: number;
  updated_at?: string;
  updated_by?: string;
};

export type TenantQuota = {
  tenant_id: string;
  max_accounts: number;
  max_functions: number;
  max_rpc_per_min: number;
  max_storage_bytes: number;
  max_gas_per_day: number;
  features?: string[];
  updated_at?: string;
  updated_by?: string;
};

export type AllowedMethod = {
  chain_id: string;
  methods: string[];
};

// Chain RPCs
export async function fetchChainRPCs(config: ClientConfig): Promise<ChainRPC[]> {
  const url = `${config.baseUrl}/admin/config/chains`;
  return fetchJSON<ChainRPC[]>(url, config);
}

export async function createChainRPC(config: ClientConfig, rpc: Partial<ChainRPC>): Promise<ChainRPC> {
  const url = `${config.baseUrl}/admin/config/chains`;
  return fetchJSON<ChainRPC>(url, config, { method: "POST", body: JSON.stringify(rpc) });
}

export async function updateChainRPC(config: ClientConfig, id: string, rpc: Partial<ChainRPC>): Promise<ChainRPC> {
  const url = `${config.baseUrl}/admin/config/chains/${id}`;
  return fetchJSON<ChainRPC>(url, config, { method: "PUT", body: JSON.stringify(rpc) });
}

export async function deleteChainRPC(config: ClientConfig, id: string): Promise<void> {
  const url = `${config.baseUrl}/admin/config/chains/${id}`;
  await fetchJSON<void>(url, config, { method: "DELETE" });
}

// Data Providers
export async function fetchDataProviders(config: ClientConfig, type?: string): Promise<DataProvider[]> {
  const params = type ? `?type=${encodeURIComponent(type)}` : "";
  const url = `${config.baseUrl}/admin/config/providers${params}`;
  return fetchJSON<DataProvider[]>(url, config);
}

export async function createDataProvider(config: ClientConfig, provider: Partial<DataProvider>): Promise<DataProvider> {
  const url = `${config.baseUrl}/admin/config/providers`;
  return fetchJSON<DataProvider>(url, config, { method: "POST", body: JSON.stringify(provider) });
}

export async function updateDataProvider(config: ClientConfig, id: string, provider: Partial<DataProvider>): Promise<DataProvider> {
  const url = `${config.baseUrl}/admin/config/providers/${id}`;
  return fetchJSON<DataProvider>(url, config, { method: "PUT", body: JSON.stringify(provider) });
}

export async function deleteDataProvider(config: ClientConfig, id: string): Promise<void> {
  const url = `${config.baseUrl}/admin/config/providers/${id}`;
  await fetchJSON<void>(url, config, { method: "DELETE" });
}

// System Settings
export async function fetchSettings(config: ClientConfig, category?: string): Promise<SystemSetting[]> {
  const params = category ? `?category=${encodeURIComponent(category)}` : "";
  const url = `${config.baseUrl}/admin/config/settings${params}`;
  return fetchJSON<SystemSetting[]>(url, config);
}

export async function updateSetting(config: ClientConfig, key: string, setting: Partial<SystemSetting>): Promise<SystemSetting> {
  const url = `${config.baseUrl}/admin/config/settings/${encodeURIComponent(key)}`;
  return fetchJSON<SystemSetting>(url, config, { method: "PUT", body: JSON.stringify(setting) });
}

// Feature Flags
export async function fetchFeatureFlags(config: ClientConfig): Promise<FeatureFlag[]> {
  const url = `${config.baseUrl}/admin/config/features`;
  return fetchJSON<FeatureFlag[]>(url, config);
}

export async function updateFeatureFlag(config: ClientConfig, key: string, flag: Partial<FeatureFlag>): Promise<FeatureFlag> {
  const url = `${config.baseUrl}/admin/config/features/${encodeURIComponent(key)}`;
  return fetchJSON<FeatureFlag>(url, config, { method: "PUT", body: JSON.stringify(flag) });
}

export async function createFeatureFlag(config: ClientConfig, flag: Partial<FeatureFlag>): Promise<FeatureFlag> {
  const url = `${config.baseUrl}/admin/config/features`;
  return fetchJSON<FeatureFlag>(url, config, { method: "POST", body: JSON.stringify(flag) });
}

// Tenant Quotas
export async function fetchTenantQuotas(config: ClientConfig): Promise<TenantQuota[]> {
  const url = `${config.baseUrl}/admin/config/quotas`;
  return fetchJSON<TenantQuota[]>(url, config);
}

export async function updateTenantQuota(config: ClientConfig, tenantId: string, quota: Partial<TenantQuota>): Promise<TenantQuota> {
  const url = `${config.baseUrl}/admin/config/quotas/${encodeURIComponent(tenantId)}`;
  return fetchJSON<TenantQuota>(url, config, { method: "PUT", body: JSON.stringify(quota) });
}

export async function createTenantQuota(config: ClientConfig, quota: Partial<TenantQuota>): Promise<TenantQuota> {
  const url = `${config.baseUrl}/admin/config/quotas`;
  return fetchJSON<TenantQuota>(url, config, { method: "POST", body: JSON.stringify(quota) });
}

export async function deleteTenantQuota(config: ClientConfig, tenantId: string): Promise<void> {
  const url = `${config.baseUrl}/admin/config/quotas/${encodeURIComponent(tenantId)}`;
  await fetchJSON<void>(url, config, { method: "DELETE" });
}

// Allowed Methods
export async function fetchAllowedMethods(config: ClientConfig): Promise<AllowedMethod[]> {
  const url = `${config.baseUrl}/admin/config/methods`;
  return fetchJSON<AllowedMethod[]>(url, config);
}

export async function updateAllowedMethods(config: ClientConfig, chainId: string, methods: string[]): Promise<AllowedMethod> {
  const url = `${config.baseUrl}/admin/config/methods/${encodeURIComponent(chainId)}`;
  return fetchJSON<AllowedMethod>(url, config, { method: "PUT", body: JSON.stringify({ chain_id: chainId, methods }) });
}
