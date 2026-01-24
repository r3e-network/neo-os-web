/**
 * Neo MiniApp SDK Types for uni-app
 */

export type ChainType = "neo-n3" | "evm";
export type ChainId = string;

export interface MiniAppChainContract {
  address: string | null;
  active?: boolean;
  entryUrl?: string;
}

export type MiniAppChainContracts = Record<ChainId, MiniAppChainContract>;

export interface PayGASResponse {
  request_id: string;
  user_id: string;
  intent: "payments";
  constraints: { settlement: "GAS_ONLY" | "NATIVE_TOKEN" };
  chain_id: ChainId;
  chain_type: ChainType;
  invocation: InvocationIntent;
  txid?: string | null;
  receipt_id?: string | null;
}

export interface VoteBNEOResponse {
  request_id: string;
  user_id: string;
  intent: "governance";
  constraints: { governance: "BNEO_ONLY" };
  chain_id: ChainId;
  chain_type: ChainType;
  invocation: InvocationIntent;
  txid?: string | null;
}

export interface RNGResponse {
  request_id: string;
  app_id: string;
  chain_id: ChainId;
  chain_type: ChainType;
  randomness: string;
  signature?: string;
  public_key?: string;
  attestation_hash?: string;
  report_hash?: string;
  anchored_tx?: unknown;
}

export interface PriceResponse {
  feed_id: string;
  pair: string;
  price: string;
  decimals: number;
  timestamp: string;
  sources: string[];
}

export interface PricesResponse {
  neo: { usd: number; usd_24h_change: number };
  gas: { usd: number; usd_24h_change: number };
  timestamp: number;
}

export interface NetworkStatsResponse {
  blockHeight: number;
  validatorCount: number;
  network: string;
  version: string;
}

export interface RecentTransaction {
  txid: string;
  blockHeight: number;
  blockTime?: number;
  sender?: string | null;
  size?: number;
  sysfee?: string;
  netfee?: string;
}

export interface RecentTransactionsResponse {
  transactions: RecentTransaction[];
  blockHeight: number;
}

export interface EventsListParams {
  app_id?: string;
  event_name?: string;
  chain_id?: ChainId;
  contract_address?: string;
  limit?: number;
  after_id?: string;
}

export interface ContractEvent {
  id: string;
  tx_hash: string;
  chain_id: ChainId;
  block_index: number;
  contract_address: string;
  event_name: string;
  app_id: string | null;
  state: unknown;
  created_at: string;
}

export interface EventsListResponse {
  events: ContractEvent[];
  has_more: boolean;
  last_id: string | null;
}

export interface TransactionsListParams {
  app_id?: string;
  chain_id?: ChainId;
  limit?: number;
  after_id?: string;
}

export interface ChainTransaction {
  id: string;
  tx_hash: string | null;
  request_id: string;
  from_service: string;
  tx_type: string;
  chain_id?: ChainId;
  contract_address: string;
  method_name: string;
  params: Record<string, unknown>;
  gas_consumed: number | null;
  status: string;
  retry_count: number;
  error_message: string | null;
  rpc_endpoint: string | null;
  submitted_at: string;
  confirmed_at: string | null;
}

export interface TransactionsListResponse {
  transactions: ChainTransaction[];
  has_more: boolean;
  last_id: string | null;
}

export type InvocationIntent =
  | {
    chain_id: ChainId;
    chain_type: "neo-n3";
    contract_address: string;
    method: string;
    params?: unknown[];
    args?: unknown[];
  }
  | {
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

/** App usage statistics */
export interface AppUsageStats {
  app_id: string;
  chain_id?: ChainId;
  date: string;
  transactions: number;
  volume_gas: string;
  unique_users: number;
}

export interface MiniAppSDK {
  invoke(method: string, ...args: unknown[]): Promise<unknown>;
  getConfig(): MiniAppSDKConfig;
  wallet: {
    getAddress(): Promise<string>;
    /** Request to switch the wallet to a specific chain */
    switchChain(chainId: ChainId): Promise<void>;
    invokeIntent?(requestId: string): Promise<unknown>;
    signMessage?(message: string): Promise<unknown>;
  };
  payments: {
    payGAS(appId: string, amount: string, memo?: string): Promise<PayGASResponse>;
    payGASAndInvoke?(appId: string, amount: string, memo?: string): Promise<PayGASResponse>;
  };
  governance: {
    vote(appId: string, proposalId: string, amount: string, support?: boolean): Promise<VoteBNEOResponse>;
    voteAndInvoke?(appId: string, proposalId: string, amount: string, support?: boolean): Promise<VoteBNEOResponse>;
    getCandidates(): Promise<CandidatesResponse>;
  };
  rng: {
    requestRandom(appId: string): Promise<RNGResponse>;
  };
  datafeed: {
    getPrice(symbol: string): Promise<PriceResponse>;
    getPrices?(): Promise<PricesResponse>;
    getNetworkStats?(): Promise<NetworkStatsResponse>;
    getRecentTransactions?(limit?: number): Promise<RecentTransactionsResponse>;
  };
  events?: {
    list(params?: EventsListParams): Promise<EventsListResponse>;
  };
  transactions?: {
    list(params?: TransactionsListParams): Promise<TransactionsListResponse>;
  };
  stats?: {
    getMyUsage(appId: string, date?: string): Promise<AppUsageStats>;
  };
}

export interface MiniAppSDKConfig {
  appId: string;
  contractAddress?: string | null;
  chainId?: ChainId | null;
  chainType?: ChainType;
  supportedChains?: ChainId[];
  chainContracts?: MiniAppChainContracts;
  debug?: boolean;
}

export type NetworkType = "testnet" | "mainnet";

/** Neo Governance Candidate */
export interface Candidate {
  address: string;
  publicKey: string;
  name?: string;
  votes: string;
  active: boolean;
}

/** Candidates list response */
export interface CandidatesResponse {
  candidates: Candidate[];
  totalVotes: string;
  blockHeight: number;
}
