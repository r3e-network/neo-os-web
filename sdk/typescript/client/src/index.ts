/**
 * Service Layer HTTP Client
 * Typed, endpoint-accurate SDK for interacting with the Service Layer API.
 */

// ---------------------------------------------------------------------------//
// Types
// ---------------------------------------------------------------------------//

export interface ClientConfig {
  baseURL: string;
  token?: string;
  refreshToken?: string;
  tenantID?: string;
  timeout?: number;
}

export interface PaginationParams {
  limit?: number;
  [key: string]: number | undefined;
}

export interface Account {
  ID: string;
  Owner: string;
  Metadata?: Record<string, string>;
  CreatedAt: string;
  UpdatedAt: string;
}

export interface WorkspaceWallet {
  ID: string;
  WorkspaceID: string;
  WalletAddress: string;
  Label?: string;
  Status?: string;
  CreatedAt: string;
  UpdatedAt: string;
}

export interface FunctionDef {
  ID: string;
  AccountID: string;
  Name: string;
  Description?: string;
  Source: string;
  Secrets?: string[];
  CreatedAt: string;
  UpdatedAt: string;
}

export interface FunctionExecution {
  ID: string;
  AccountID: string;
  FunctionID: string;
  Status: string;
  Input?: unknown;
  Output?: unknown;
  Error?: string;
  CreatedAt: string;
  StartedAt?: string;
  CompletedAt?: string;
}

export interface Trigger {
  ID: string;
  AccountID: string;
  FunctionID: string;
  Type: string;
  Rule?: string;
  Config?: Record<string, string>;
  Enabled: boolean;
  CreatedAt: string;
  UpdatedAt: string;
}

export interface Secret {
  ID: string;
  AccountID: string;
  Name: string;
  CreatedAt: string;
  UpdatedAt: string;
}

export interface GasAccount {
  ID: string;
  AccountID: string;
  WalletAddress: string;
  Balance: number;
  Available: number;
  Pending: number;
  Locked: number;
  MinBalance: number;
  DailyLimit: number;
  NotificationThreshold: number;
  RequiredApprovals: number;
  CreatedAt: string;
  UpdatedAt: string;
}

export interface GasTransaction {
  ID: string;
  GasAccountID: string;
  Type: string;
  Status: string;
  Amount: number;
  FromAddress?: string;
  ToAddress?: string;
  ScheduleAt?: string;
  CreatedAt: string;
  UpdatedAt: string;
}

export interface GasSummary {
  accounts: GasAccount[];
  total_balance: number;
  total_available: number;
  pending_amount: number;
  pending_withdrawals: number;
}

export interface SettlementAttempt {
  TransactionID: string;
  Attempt: number;
  Status: string;
  Error?: string;
  StartedAt: string;
  CompletedAt: string;
}

export interface DeadLetter {
  TransactionID: string;
  AccountID: string;
  Reason: string;
  LastError: string;
  Retries: number;
  LastAttemptAt: string;
  CreatedAt: string;
  UpdatedAt: string;
}

export interface AutomationJob {
  ID: string;
  AccountID: string;
  FunctionID: string;
  Name: string;
  Schedule: string;
  Description?: string;
  Enabled: boolean;
  CreatedAt: string;
  UpdatedAt: string;
}

export interface PriceFeed {
  ID: string;
  AccountID: string;
  BaseAsset: string;
  QuoteAsset: string;
  UpdateInterval: string;
  HeartbeatInterval: string;
  DeviationPercent: number;
  Active: boolean;
  CreatedAt: string;
  UpdatedAt: string;
}

export interface PriceSnapshot {
  ID: string;
  FeedID: string;
  Price: number;
  Source?: string;
  CollectedAt?: string;
  CreatedAt: string;
}

export interface DataFeed {
  ID: string;
  AccountID: string;
  Pair: string;
  Description?: string;
  Decimals: number;
  Heartbeat: number;
  ThresholdPPM: number;
  SignerSet: string[];
  Aggregation: string;
  Metadata?: Record<string, string>;
  Tags?: string[];
  CreatedAt: string;
  UpdatedAt: string;
}

export interface DataFeedUpdate {
  ID: string;
  FeedID: string;
  RoundID: number;
  Price: string;
  Signer: string;
  Timestamp: string;
  Signature?: string;
  Metadata?: Record<string, string>;
  CreatedAt: string;
}

export interface DataStream {
  ID: string;
  AccountID: string;
  Name: string;
  Symbol?: string;
  Description?: string;
  Frequency?: string;
  SLAms?: number;
  Status?: string;
  Metadata?: Record<string, string>;
  CreatedAt: string;
  UpdatedAt: string;
}

export interface DataStreamFrame {
  ID: string;
  StreamID: string;
  Sequence: number;
  Payload: Record<string, unknown>;
  LatencyMS?: number;
  Status?: string;
  Metadata?: Record<string, string>;
  CreatedAt: string;
}

export interface OracleSource {
  ID: string;
  AccountID: string;
  Name: string;
  URL: string;
  Method: string;
  Headers?: Record<string, string>;
  Body?: string;
  Enabled: boolean;
  CreatedAt: string;
  UpdatedAt: string;
}

export interface OracleRequest {
  ID: string;
  AccountID: string;
  DataSourceID: string;
  Payload: string;
  Status: string;
  Result?: string;
  Error?: string;
  CreatedAt: string;
  UpdatedAt: string;
  CompletedAt?: string;
}

export interface VRFKey {
  ID: string;
  AccountID: string;
  PublicKey: string;
  Label?: string;
  Status?: string;
  WalletAddress?: string;
  Metadata?: Record<string, string>;
  CreatedAt: string;
  UpdatedAt: string;
}

export interface VRFRequest {
  ID: string;
  AccountID: string;
  KeyID: string;
  Consumer: string;
  Seed: string;
  Status: string;
  Output?: string;
  Proof?: string;
  Metadata?: Record<string, string>;
  CreatedAt: string;
  CompletedAt?: string;
}

export interface RandomRequest {
  ID: string;
  AccountID: string;
  Length: number;
  RequestID?: string;
  Status: string;
  Value?: string;
  CreatedAt: string;
  CompletedAt?: string;
}

export interface CCIPLane {
  ID: string;
  AccountID: string;
  Name: string;
  SourceChain: string;
  DestChain: string;
  SignerSet?: string[];
  AllowedTokens?: string[];
  DeliveryPolicy?: Record<string, unknown>;
  Metadata?: Record<string, string>;
  Tags?: string[];
  CreatedAt: string;
  UpdatedAt: string;
}

export interface CCIPMessage {
  ID: string;
  AccountID: string;
  LaneID: string;
  Payload: Record<string, unknown>;
  TokenTransfers?: Record<string, unknown>[];
  Status: string;
  Metadata?: Record<string, string>;
  CreatedAt: string;
}

export interface DataLinkChannel {
  ID: string;
  AccountID: string;
  Name: string;
  Endpoint: string;
  SignerSet: string[];
  Status?: string;
  Metadata?: Record<string, string>;
  CreatedAt: string;
  UpdatedAt: string;
}

export interface DataLinkDelivery {
  ID: string;
  AccountID: string;
  ChannelID: string;
  Payload: Record<string, unknown>;
  Metadata?: Record<string, string>;
  Status: string;
  CreatedAt: string;
}

export interface DTAProduct {
  ID: string;
  AccountID: string;
  Name: string;
  Symbol: string;
  Type: string;
  Status: string;
  SettlementTerms?: string;
  Metadata?: Record<string, string>;
  CreatedAt: string;
  UpdatedAt: string;
}

export interface DTAOrder {
  ID: string;
  AccountID: string;
  ProductID: string;
  Type: string;
  Amount: string;
  WalletAddress: string;
  Status: string;
  Metadata?: Record<string, string>;
  CreatedAt: string;
}

export interface ConfEnclave {
  ID: string;
  AccountID: string;
  Name: string;
  Endpoint: string;
  Status: string;
  Metadata?: Record<string, string>;
  CreatedAt: string;
  UpdatedAt: string;
}

export interface ConfSealedKey {
  ID: string;
  AccountID: string;
  EnclaveID: string;
  Name: string;
  Metadata?: Record<string, string>;
  CreatedAt: string;
}

export interface ConfAttestation {
  ID: string;
  AccountID: string;
  EnclaveID: string;
  Report: string;
  Status: string;
  Metadata?: Record<string, string>;
  CreatedAt: string;
}

export interface CREPlaybook {
  ID: string;
  AccountID: string;
  Name: string;
  Description?: string;
  Tags?: string[];
  Metadata?: Record<string, string>;
  Steps?: Record<string, unknown>[];
  CreatedAt: string;
  UpdatedAt: string;
}

export interface CREExecutor {
  ID: string;
  AccountID: string;
  Name: string;
  Type: string;
  Endpoint: string;
  Metadata?: Record<string, string>;
  Tags?: string[];
  CreatedAt: string;
  UpdatedAt: string;
}

export interface CRERun {
  ID: string;
  AccountID: string;
  PlaybookID: string;
  ExecutorID: string;
  Status: string;
  Params?: Record<string, unknown>;
  Result?: Record<string, unknown>;
  Error?: string;
  Tags?: string[];
  CreatedAt: string;
  CompletedAt?: string;
}

export interface ComputeResult {
  Module: string;
  Result?: unknown;
  Error?: string;
}

export interface ComputeResponse {
  results: ComputeResult[];
  error?: string;
}

// ---------------------------------------------------------------------------//
// Client
// ---------------------------------------------------------------------------//

export class ServiceLayerError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public response?: unknown
  ) {
    super(message);
    this.name = 'ServiceLayerError';
  }
}

export class ServiceLayerClient {
  private readonly baseURL: string;
  private token: string;
  private readonly refreshToken?: string;
  private readonly tenantID: string;
  private readonly timeout: number;

  constructor(config: ClientConfig) {
    this.baseURL = config.baseURL.replace(/\/$/, '');
    this.token = config.token || '';
    this.refreshToken = config.refreshToken || '';
    this.tenantID = config.tenantID || '';
    this.timeout = config.timeout ?? 30000;
  }

  private buildQuery(params?: Record<string, unknown>): string {
    if (!params) return '';
    const qs = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === null || value === '') continue;
      qs.set(key, String(value));
    }
    const query = qs.toString();
    return query ? `?${query}` : '';
  }

  private async request<T>(method: string, path: string, body?: unknown, query?: Record<string, unknown>): Promise<T> {
    if (!this.token && this.refreshToken) {
      await this.refreshAccessToken();
    }
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);
    const url = `${this.baseURL}${path}${this.buildQuery(query)}`;

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`;
    if (this.tenantID) headers['X-Tenant-ID'] = this.tenantID;

    try {
      let response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      if (response.status === 401 && this.refreshToken) {
        if (await this.refreshAccessToken()) {
          headers['Authorization'] = `Bearer ${this.token}`;
          response = await fetch(url, {
            method,
            headers,
            body: body ? JSON.stringify(body) : undefined,
            signal: controller.signal,
          });
        }
      }

      const raw = await response.text();
      let parsed: unknown;
      try {
        parsed = raw ? JSON.parse(raw) : undefined;
      } catch {
        parsed = raw;
      }

      if (!response.ok) {
        throw new ServiceLayerError(`HTTP ${response.status}: ${response.statusText}`, response.status, parsed);
      }
      return parsed as T;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private async refreshAccessToken(): Promise<boolean> {
    try {
      const resp = await fetch(`${this.baseURL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: this.refreshToken }),
      });
      if (!resp.ok) return false;
      // Support both real fetch Response and lightweight mocks that only expose text()
      let payload: any = {};
      if (typeof (resp as any).json === 'function') {
        payload = await (resp as any).json();
      } else if (typeof (resp as any).text === 'function') {
        const raw = await (resp as any).text();
        try {
          payload = raw ? JSON.parse(raw) : {};
        } catch {
          payload = {};
        }
      }
      const json = payload || {};
      const token = (json.access_token || json.token || '').trim();
      if (token) {
        this.token = token;
        return true;
      }
    } catch {
      // ignore
    }
    return false;
  }

  // Accounts & wallets
  readonly accounts = {
    create: (owner: string, metadata?: Record<string, string>): Promise<Account> =>
      this.request('POST', '/accounts', { owner, metadata }),
    list: (): Promise<Account[]> => this.request('GET', '/accounts'),
    get: (id: string): Promise<Account> => this.request('GET', `/accounts/${id}`),
    delete: (id: string): Promise<void> => this.request('DELETE', `/accounts/${id}`),
  };

  readonly workspaceWallets = {
    create: (accountId: string, params: { wallet_address: string; label?: string; status?: string }): Promise<WorkspaceWallet> =>
      this.request('POST', `/accounts/${accountId}/workspace-wallets`, params),
    list: (accountId: string): Promise<WorkspaceWallet[]> =>
      this.request('GET', `/accounts/${accountId}/workspace-wallets`),
    get: (accountId: string, walletId: string): Promise<WorkspaceWallet> =>
      this.request('GET', `/accounts/${accountId}/workspace-wallets/${walletId}`),
  };

  // Functions & triggers
  readonly functions = {
    create: (accountId: string, params: { name: string; description?: string; source: string; secrets?: string[] }): Promise<FunctionDef> =>
      this.request('POST', `/accounts/${accountId}/functions`, params),
    list: (accountId: string): Promise<FunctionDef[]> =>
      this.request('GET', `/accounts/${accountId}/functions`),
    execute: (accountId: string, functionId: string, input?: Record<string, unknown>): Promise<FunctionExecution> =>
      this.request('POST', `/accounts/${accountId}/functions/${functionId}/execute`, input),
    listExecutions: (accountId: string, functionId: string, pagination?: PaginationParams): Promise<FunctionExecution[]> =>
      this.request('GET', `/accounts/${accountId}/functions/${functionId}/executions`, undefined, pagination),
    getExecution: (accountId: string, executionId: string): Promise<FunctionExecution> =>
      this.request('GET', `/accounts/${accountId}/functions/executions/${executionId}`),
  };

  readonly triggers = {
    create: (accountId: string, params: { function_id: string; type: string; rule?: string; config?: Record<string, string>; enabled?: boolean }): Promise<Trigger> =>
      this.request('POST', `/accounts/${accountId}/triggers`, params),
    list: (accountId: string): Promise<Trigger[]> =>
      this.request('GET', `/accounts/${accountId}/triggers`),
  };

  // Secrets
  readonly secrets = {
    create: (accountId: string, params: { name: string; value: string; tenant_id?: string }): Promise<Secret> =>
      this.request('POST', `/accounts/${accountId}/secrets`, params),
    list: (accountId: string): Promise<Secret[]> =>
      this.request('GET', `/accounts/${accountId}/secrets`),
  };

  // Gas bank
  readonly gasBank = {
    ensureAccount: (accountId: string, params: {
      wallet_address: string;
      min_balance?: number;
      daily_limit?: number;
      notification_threshold?: number;
      required_approvals?: number;
    }): Promise<GasAccount> =>
      this.request('POST', `/accounts/${accountId}/gasbank`, params),

    listAccounts: (accountId: string): Promise<GasAccount[]> =>
      this.request('GET', `/accounts/${accountId}/gasbank`),

    summary: (accountId: string): Promise<GasSummary> =>
      this.request('GET', `/accounts/${accountId}/gasbank/summary`),

    deposit: (accountId: string, params: { gas_account_id: string; amount: number; tx_id: string; from_address?: string; to_address?: string }): Promise<{ account: GasAccount; transaction: GasTransaction }> =>
      this.request('POST', `/accounts/${accountId}/gasbank/deposit`, params),

    withdraw: (accountId: string, params: { gas_account_id: string; amount: number; to_address: string; schedule_at?: string }): Promise<{ account: GasAccount; transaction: GasTransaction }> =>
      this.request('POST', `/accounts/${accountId}/gasbank/withdraw`, params),

    listTransactions: (accountId: string, filters?: { gas_account_id?: string; type?: string; status?: string; limit?: number }): Promise<GasTransaction[]> =>
      this.request('GET', `/accounts/${accountId}/gasbank/transactions`, undefined, filters),

    listWithdrawals: (accountId: string, filters: { gas_account_id: string; status?: string; limit?: number }): Promise<GasTransaction[]> =>
      this.request('GET', `/accounts/${accountId}/gasbank/withdrawals`, undefined, filters),

    getWithdrawal: (accountId: string, withdrawalId: string): Promise<GasTransaction> =>
      this.request('GET', `/accounts/${accountId}/gasbank/withdrawals/${withdrawalId}`),

    listAttempts: (accountId: string, withdrawalId: string, pagination?: PaginationParams): Promise<SettlementAttempt[]> =>
      this.request('GET', `/accounts/${accountId}/gasbank/withdrawals/${withdrawalId}/attempts`, undefined, pagination),

    listDeadLetters: (accountId: string, pagination?: PaginationParams): Promise<DeadLetter[]> =>
      this.request('GET', `/accounts/${accountId}/gasbank/deadletters`, undefined, pagination),

    retryDeadLetter: (accountId: string, txId: string): Promise<GasTransaction> =>
      this.request('POST', `/accounts/${accountId}/gasbank/deadletters/${txId}/retry`),

    deleteDeadLetter: (accountId: string, txId: string): Promise<void> =>
      this.request('DELETE', `/accounts/${accountId}/gasbank/deadletters/${txId}`),
  };

  // Automation
  readonly automation = {
    createJob: (accountId: string, params: { function_id: string; name: string; schedule: string; description?: string }): Promise<AutomationJob> =>
      this.request('POST', `/accounts/${accountId}/automation/jobs`, params),
    listJobs: (accountId: string): Promise<AutomationJob[]> =>
      this.request('GET', `/accounts/${accountId}/automation/jobs`),
    getJob: (accountId: string, jobId: string): Promise<AutomationJob> =>
      this.request('GET', `/accounts/${accountId}/automation/jobs/${jobId}`),
    updateJob: (accountId: string, jobId: string, params: { name?: string; schedule?: string; description?: string; enabled?: boolean; next_run?: string }): Promise<AutomationJob> =>
      this.request('PATCH', `/accounts/${accountId}/automation/jobs/${jobId}`, params),
  };

  // Price feeds
  readonly priceFeeds = {
    create: (accountId: string, params: { base_asset: string; quote_asset: string; update_interval: string; heartbeat_interval: string; deviation_percent: number }): Promise<PriceFeed> =>
      this.request('POST', `/accounts/${accountId}/pricefeeds`, params),
    list: (accountId: string): Promise<PriceFeed[]> =>
      this.request('GET', `/accounts/${accountId}/pricefeeds`),
    get: (accountId: string, feedId: string): Promise<PriceFeed> =>
      this.request('GET', `/accounts/${accountId}/pricefeeds/${feedId}`),
    update: (accountId: string, feedId: string, params: { update_interval?: string; heartbeat_interval?: string; deviation_percent?: number; active?: boolean }): Promise<PriceFeed> =>
      this.request('PATCH', `/accounts/${accountId}/pricefeeds/${feedId}`, params),
    recordSnapshot: (accountId: string, feedId: string, params: { price: number; source?: string; collected_at?: string }): Promise<PriceSnapshot> =>
      this.request('POST', `/accounts/${accountId}/pricefeeds/${feedId}/snapshots`, params),
    listSnapshots: (accountId: string, feedId: string): Promise<PriceSnapshot[]> =>
      this.request('GET', `/accounts/${accountId}/pricefeeds/${feedId}/snapshots`),
  };

  // Data feeds
  readonly dataFeeds = {
    create: (accountId: string, params: { pair: string; description?: string; decimals?: number; heartbeat_seconds?: number; threshold_ppm?: number; signer_set?: string[]; aggregation?: string; metadata?: Record<string, string>; tags?: string[] }): Promise<DataFeed> =>
      this.request('POST', `/accounts/${accountId}/datafeeds`, params),
    list: (accountId: string): Promise<DataFeed[]> =>
      this.request('GET', `/accounts/${accountId}/datafeeds`),
    get: (accountId: string, feedId: string): Promise<DataFeed> =>
      this.request('GET', `/accounts/${accountId}/datafeeds/${feedId}`),
    update: (accountId: string, feedId: string, params: { pair?: string; description?: string; decimals?: number; heartbeat_seconds?: number; threshold_ppm?: number; signer_set?: string[]; aggregation?: string; metadata?: Record<string, string>; tags?: string[] }): Promise<DataFeed> =>
      this.request('PUT', `/accounts/${accountId}/datafeeds/${feedId}`, params),
    submitUpdate: (accountId: string, feedId: string, params: { round_id: number; price: string | number; signer: string; timestamp: string; signature?: string; metadata?: Record<string, string> }): Promise<DataFeedUpdate> =>
      this.request('POST', `/accounts/${accountId}/datafeeds/${feedId}/updates`, params),
    listUpdates: (accountId: string, feedId: string, pagination?: PaginationParams): Promise<DataFeedUpdate[]> =>
      this.request('GET', `/accounts/${accountId}/datafeeds/${feedId}/updates`, undefined, pagination),
    latest: (accountId: string, feedId: string): Promise<DataFeedUpdate> =>
      this.request('GET', `/accounts/${accountId}/datafeeds/${feedId}/latest`),
  };

  // Data streams
  readonly dataStreams = {
    create: (accountId: string, params: { name: string; symbol?: string; description?: string; frequency?: string; sla_ms?: number; status?: string; metadata?: Record<string, string> }): Promise<DataStream> =>
      this.request('POST', `/accounts/${accountId}/datastreams`, params),
    list: (accountId: string): Promise<DataStream[]> =>
      this.request('GET', `/accounts/${accountId}/datastreams`),
    get: (accountId: string, streamId: string): Promise<DataStream> =>
      this.request('GET', `/accounts/${accountId}/datastreams/${streamId}`),
    update: (accountId: string, streamId: string, params: { name?: string; symbol?: string; description?: string; frequency?: string; sla_ms?: number; status?: string; metadata?: Record<string, string> }): Promise<DataStream> =>
      this.request('PUT', `/accounts/${accountId}/datastreams/${streamId}`, params),
    createFrame: (accountId: string, streamId: string, params: { sequence: number; payload: Record<string, unknown>; latency_ms?: number; status?: string; metadata?: Record<string, string> }): Promise<DataStreamFrame> =>
      this.request('POST', `/accounts/${accountId}/datastreams/${streamId}/frames`, params),
    listFrames: (accountId: string, streamId: string, pagination?: PaginationParams): Promise<DataStreamFrame[]> =>
      this.request('GET', `/accounts/${accountId}/datastreams/${streamId}/frames`, undefined, pagination),
  };

  // Oracle
  readonly oracle = {
    createSource: (accountId: string, params: { name: string; url: string; method: string; headers?: Record<string, string>; body?: string; enabled?: boolean; metadata?: Record<string, string> }): Promise<OracleSource> =>
      this.request('POST', `/accounts/${accountId}/oracle/sources`, params),
    listSources: (accountId: string): Promise<OracleSource[]> =>
      this.request('GET', `/accounts/${accountId}/oracle/sources`),
    createRequest: (accountId: string, params: { data_source_id: string; payload: string }): Promise<OracleRequest> =>
      this.request('POST', `/accounts/${accountId}/oracle/requests`, params),
    listRequests: (accountId: string, filters?: { status?: string; limit?: number }): Promise<OracleRequest[]> =>
      this.request('GET', `/accounts/${accountId}/oracle/requests`, undefined, filters),
    updateRequest: (accountId: string, requestId: string, params: { status: string; result?: string; error?: string }): Promise<OracleRequest> =>
      this.request('PATCH', `/accounts/${accountId}/oracle/requests/${requestId}`, params),
  };

  // VRF
  readonly vrf = {
    createKey: (accountId: string, params: { public_key?: string; label?: string; status?: string; wallet_address?: string; attestation?: string; metadata?: Record<string, string> }): Promise<VRFKey> =>
      this.request('POST', `/accounts/${accountId}/vrf/keys`, params),
    listKeys: (accountId: string): Promise<VRFKey[]> =>
      this.request('GET', `/accounts/${accountId}/vrf/keys`),
    getKey: (accountId: string, keyId: string): Promise<VRFKey> =>
      this.request('GET', `/accounts/${accountId}/vrf/keys/${keyId}`),
    updateKey: (accountId: string, keyId: string, params: { public_key?: string; label?: string; status?: string; wallet_address?: string; attestation?: string; metadata?: Record<string, string> }): Promise<VRFKey> =>
      this.request('PUT', `/accounts/${accountId}/vrf/keys/${keyId}`, params),
    createRequest: (accountId: string, keyId: string, params: { consumer: string; seed: string; metadata?: Record<string, string> }): Promise<VRFRequest> =>
      this.request('POST', `/accounts/${accountId}/vrf/keys/${keyId}/requests`, params),
    listRequests: (accountId: string, pagination?: PaginationParams): Promise<VRFRequest[]> =>
      this.request('GET', `/accounts/${accountId}/vrf/requests`, undefined, pagination),
    getRequest: (accountId: string, requestId: string): Promise<VRFRequest> =>
      this.request('GET', `/accounts/${accountId}/vrf/requests/${requestId}`),
  };

  // Randomness
  readonly random = {
    generate: (accountId: string, params: { length: number; request_id?: string }): Promise<RandomRequest> =>
      this.request('POST', `/accounts/${accountId}/random`, params),
    list: (accountId: string, pagination?: PaginationParams): Promise<RandomRequest[]> =>
      this.request('GET', `/accounts/${accountId}/random/requests`, undefined, pagination),
  };

  // CCIP
  readonly ccip = {
    createLane: (accountId: string, params: { name: string; source_chain: string; dest_chain: string; signer_set?: string[]; allowed_tokens?: string[]; delivery_policy?: Record<string, unknown>; metadata?: Record<string, string>; tags?: string[] }): Promise<CCIPLane> =>
      this.request('POST', `/accounts/${accountId}/ccip/lanes`, params),
    listLanes: (accountId: string): Promise<CCIPLane[]> =>
      this.request('GET', `/accounts/${accountId}/ccip/lanes`),
    getLane: (accountId: string, laneId: string): Promise<CCIPLane> =>
      this.request('GET', `/accounts/${accountId}/ccip/lanes/${laneId}`),
    updateLane: (accountId: string, laneId: string, params: { name?: string; source_chain?: string; dest_chain?: string; signer_set?: string[]; allowed_tokens?: string[]; delivery_policy?: Record<string, unknown>; metadata?: Record<string, string>; tags?: string[] }): Promise<CCIPLane> =>
      this.request('PUT', `/accounts/${accountId}/ccip/lanes/${laneId}`, params),
    sendMessage: (accountId: string, laneId: string, params: { payload: Record<string, unknown>; token_transfers?: Record<string, unknown>[]; metadata?: Record<string, string>; tags?: string[] }): Promise<CCIPMessage> =>
      this.request('POST', `/accounts/${accountId}/ccip/lanes/${laneId}/messages`, params),
    listMessages: (accountId: string, pagination?: PaginationParams): Promise<CCIPMessage[]> =>
      this.request('GET', `/accounts/${accountId}/ccip/messages`, undefined, pagination),
    getMessage: (accountId: string, messageId: string): Promise<CCIPMessage> =>
      this.request('GET', `/accounts/${accountId}/ccip/messages/${messageId}`),
  };

  // DataLink
  readonly dataLink = {
    createChannel: (accountId: string, params: { name: string; endpoint: string; auth_token?: string; signer_set: string[]; status?: string; metadata?: Record<string, string> }): Promise<DataLinkChannel> =>
      this.request('POST', `/accounts/${accountId}/datalink/channels`, params),
    listChannels: (accountId: string): Promise<DataLinkChannel[]> =>
      this.request('GET', `/accounts/${accountId}/datalink/channels`),
    getChannel: (accountId: string, channelId: string): Promise<DataLinkChannel> =>
      this.request('GET', `/accounts/${accountId}/datalink/channels/${channelId}`),
    updateChannel: (accountId: string, channelId: string, params: { name?: string; endpoint?: string; auth_token?: string; signer_set: string[]; status?: string; metadata?: Record<string, string> }): Promise<DataLinkChannel> =>
      this.request('PUT', `/accounts/${accountId}/datalink/channels/${channelId}`, params),
    createDelivery: (accountId: string, channelId: string, params: { payload: Record<string, unknown>; metadata?: Record<string, string> }): Promise<DataLinkDelivery> =>
      this.request('POST', `/accounts/${accountId}/datalink/channels/${channelId}/deliveries`, params),
    listDeliveries: (accountId: string, pagination?: PaginationParams): Promise<DataLinkDelivery[]> =>
      this.request('GET', `/accounts/${accountId}/datalink/deliveries`, undefined, pagination),
    getDelivery: (accountId: string, deliveryId: string): Promise<DataLinkDelivery> =>
      this.request('GET', `/accounts/${accountId}/datalink/deliveries/${deliveryId}`),
  };

  // DTA
  readonly dta = {
    createProduct: (accountId: string, params: { name: string; symbol: string; type: string; status?: string; settlement_terms?: string; metadata?: Record<string, string> }): Promise<DTAProduct> =>
      this.request('POST', `/accounts/${accountId}/dta/products`, params),
    listProducts: (accountId: string): Promise<DTAProduct[]> =>
      this.request('GET', `/accounts/${accountId}/dta/products`),
    getProduct: (accountId: string, productId: string): Promise<DTAProduct> =>
      this.request('GET', `/accounts/${accountId}/dta/products/${productId}`),
    updateProduct: (accountId: string, productId: string, params: { name?: string; symbol?: string; type?: string; status?: string; settlement_terms?: string; metadata?: Record<string, string> }): Promise<DTAProduct> =>
      this.request('PUT', `/accounts/${accountId}/dta/products/${productId}`, params),
    createOrder: (accountId: string, productId: string, params: { type: string; amount: string | number; wallet_address: string; metadata?: Record<string, string> }): Promise<DTAOrder> =>
      this.request('POST', `/accounts/${accountId}/dta/products/${productId}/orders`, params),
    listOrders: (accountId: string, pagination?: PaginationParams): Promise<DTAOrder[]> =>
      this.request('GET', `/accounts/${accountId}/dta/orders`, undefined, pagination),
    getOrder: (accountId: string, orderId: string): Promise<DTAOrder> =>
      this.request('GET', `/accounts/${accountId}/dta/orders/${orderId}`),
  };

  // Confidential compute
  readonly confidential = {
    createEnclave: (accountId: string, params: { name: string; endpoint: string; provider?: string; attestation?: string; measurement?: string; status?: string; metadata?: Record<string, string> }): Promise<ConfEnclave> =>
      this.request('POST', `/accounts/${accountId}/confcompute/enclaves`, params),
    listEnclaves: (accountId: string): Promise<ConfEnclave[]> =>
      this.request('GET', `/accounts/${accountId}/confcompute/enclaves`),
    getEnclave: (accountId: string, enclaveId: string): Promise<ConfEnclave> =>
      this.request('GET', `/accounts/${accountId}/confcompute/enclaves/${enclaveId}`),
    updateEnclave: (accountId: string, enclaveId: string, params: { name?: string; endpoint?: string; provider?: string; attestation?: string; measurement?: string; status?: string; metadata?: Record<string, string> }): Promise<ConfEnclave> =>
      this.request('PUT', `/accounts/${accountId}/confcompute/enclaves/${enclaveId}`, params),
    createSealedKey: (accountId: string, params: { enclave_id: string; name: string; blob: Uint8Array; metadata?: Record<string, string> }): Promise<ConfSealedKey> =>
      this.request('POST', `/accounts/${accountId}/confcompute/sealed_keys`, params),
    listSealedKeys: (accountId: string, filters: { enclave_id: string; limit?: number }): Promise<ConfSealedKey[]> =>
      this.request('GET', `/accounts/${accountId}/confcompute/sealed_keys`, undefined, filters),
    createAttestation: (accountId: string, params: { enclave_id: string; report: string; status: string; metadata?: Record<string, string> }): Promise<ConfAttestation> =>
      this.request('POST', `/accounts/${accountId}/confcompute/attestations`, params),
    listAttestations: (accountId: string, filters?: { enclave_id?: string; limit?: number }): Promise<ConfAttestation[]> =>
      this.request('GET', `/accounts/${accountId}/confcompute/attestations`, undefined, filters),
  };

  // CRE
  readonly cre = {
    createExecutor: (accountId: string, params: { name: string; type: string; endpoint: string; metadata?: Record<string, string>; tags?: string[] }): Promise<CREExecutor> =>
      this.request('POST', `/accounts/${accountId}/cre/executors`, params),
    listExecutors: (accountId: string): Promise<CREExecutor[]> =>
      this.request('GET', `/accounts/${accountId}/cre/executors`),
    getExecutor: (accountId: string, executorId: string): Promise<CREExecutor> =>
      this.request('GET', `/accounts/${accountId}/cre/executors/${executorId}`),
    updateExecutor: (accountId: string, executorId: string, params: { name?: string; type?: string; endpoint?: string; metadata?: Record<string, string>; tags?: string[] }): Promise<CREExecutor> =>
      this.request('PUT', `/accounts/${accountId}/cre/executors/${executorId}`, params),

    createPlaybook: (accountId: string, params: { name: string; description?: string; tags?: string[]; metadata?: Record<string, string>; steps?: Record<string, unknown>[] }): Promise<CREPlaybook> =>
      this.request('POST', `/accounts/${accountId}/cre/playbooks`, params),
    listPlaybooks: (accountId: string): Promise<CREPlaybook[]> =>
      this.request('GET', `/accounts/${accountId}/cre/playbooks`),
    getPlaybook: (accountId: string, playbookId: string): Promise<CREPlaybook> =>
      this.request('GET', `/accounts/${accountId}/cre/playbooks/${playbookId}`),
    updatePlaybook: (accountId: string, playbookId: string, params: { name?: string; description?: string; tags?: string[]; metadata?: Record<string, string>; steps?: Record<string, unknown>[] }): Promise<CREPlaybook> =>
      this.request('PUT', `/accounts/${accountId}/cre/playbooks/${playbookId}`, params),

    createRun: (accountId: string, params: { playbook_id: string; executor_id?: string; params?: Record<string, unknown>; tags?: string[] }): Promise<CRERun> =>
      this.request('POST', `/accounts/${accountId}/cre/playbooks/${params.playbook_id}/runs`, params),
    listRuns: (accountId: string, pagination?: PaginationParams): Promise<CRERun[]> =>
      this.request('GET', `/accounts/${accountId}/cre/runs`, undefined, pagination),
    getRun: (accountId: string, runId: string): Promise<CRERun> =>
      this.request('GET', `/accounts/${accountId}/cre/runs/${runId}`),
  };

  // Bus
  readonly bus = {
    publishEvent: (event: string, payload: unknown): Promise<{ status: string }> =>
      this.request('POST', '/system/events', { event, payload }),
    pushData: (topic: string, payload: unknown): Promise<{ status: string }> =>
      this.request('POST', '/system/data', { topic, payload }),
    compute: (payload: unknown): Promise<ComputeResponse> =>
      this.request('POST', '/system/compute', { payload }),
  };

  // System
  readonly system = {
    health: (): Promise<Record<string, string>> =>
      this.request('GET', '/healthz'),
    status: (): Promise<Record<string, unknown>> =>
      this.request('GET', '/system/status'),
    descriptors: (): Promise<Record<string, unknown>[]> =>
      this.request('GET', '/system/descriptors'),
  };
}
