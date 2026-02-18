/**
 * MiniApp SDK Types for Mobile Wallet
 * Defines the SDK interface exposed to MiniApps via WebView bridge
 */

import type { ChainId, MiniAppChainContracts } from "@/types/miniapp";
import type { ChainType } from "@/lib/chains";
import type { MiniAppDisplayConfig, MiniAppRuntimeConfig } from "@neo/shared/types/miniapp-runtime";

export type MiniAppSDKConfig = {
  edgeBaseUrl: string;
  appId?: string;
  chainId?: ChainId | null;
  chainType?: ChainType;
  contractAddress?: string | null;
  supportedChains?: ChainId[];
  chainContracts?: MiniAppChainContracts;
  uiConfig?: MiniAppRuntimeConfig | null;
  display?: MiniAppDisplayConfig | null;
  layout?: "web" | "mobile";
  getAuthToken?: () => Promise<string | undefined>;
  getAPIKey?: () => Promise<string | undefined>;
};

export type InvocationIntent = {
  chain_id: ChainId;
  chain_type: "neo-n3";
  contract_address: string;
  method: string;
  params?: unknown[];
  args?: unknown[];
};

export type PayGASResponse = {
  request_id: string;
  user_id: string;
  intent: "payments";
  constraints: { settlement: "GAS_ONLY" | "NATIVE_TOKEN" };
  chain_id: ChainId;
  chain_type: ChainType;
  invocation: InvocationIntent;
  txid?: string | null;
  receipt_id?: string | null;
};

export type VoteBNEOResponse = {
  request_id: string;
  user_id: string;
  intent: "governance";
  constraints: { governance: "NEO_ONLY" | "BNEO_ONLY" };
  chain_id: ChainId;
  chain_type: ChainType;
  invocation: InvocationIntent;
  txid?: string | null;
};

export type RNGResponse = {
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
};

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

export type PricesResponse = {
  neo: { usd: number; usd_24h_change: number };
  gas: { usd: number; usd_24h_change: number };
  timestamp: number;
};

export type NetworkStatsResponse = {
  blockHeight: number;
  validatorCount: number;
  network: string;
  version: string;
};

export type RecentTransaction = {
  txid: string;
  blockHeight: number;
  blockTime?: number;
  sender?: string | null;
  size?: number;
  sysfee?: string;
  netfee?: string;
};

export type RecentTransactionsResponse = {
  transactions: RecentTransaction[];
  blockHeight: number;
};

export type EventsListParams = {
  app_id?: string;
  event_name?: string;
  chain_id?: ChainId;
  contract_address?: string;
  limit?: number;
  after_id?: string;
};

export type ContractEvent = {
  id: string;
  tx_hash: string;
  chain_id: ChainId;
  block_index: number;
  contract_address: string;
  event_name: string;
  app_id?: string | null;
  state?: unknown;
  created_at: string;
};

export type EventsListResponse = {
  events: ContractEvent[];
  has_more: boolean;
  last_id: string | null;
};

export type TransactionsListParams = {
  app_id?: string;
  chain_id?: ChainId;
  limit?: number;
  after_id?: string;
};

export type ChainTransaction = {
  id: string;
  tx_hash: string | null;
  request_id: string;
  from_service: string;
  tx_type: string;
  contract_address: string;
  chain_id: string | null;
  method_name: string;
  params: Record<string, unknown>;
  gas_consumed: number | null;
  status: string;
  retry_count: number;
  error_message: string | null;
  rpc_endpoint: string | null;
  submitted_at: string;
  confirmed_at: string | null;
};

export type TransactionsListResponse = {
  transactions: ChainTransaction[];
  has_more: boolean;
  last_id: string | null;
};

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

export type Candidate = {
  address: string;
  publicKey: string;
  name?: string;
  votes: string;
  active: boolean;
};

export type CandidatesResponse = {
  candidates: Candidate[];
  totalVotes: string;
  blockHeight: number;
};

export interface MiniAppSDK {
  getConfig?: () => {
    appId?: string;
    chainId?: ChainId | null;
    chainType?: ChainType;
    contractAddress?: string | null;
    supportedChains?: ChainId[];
    chainContracts?: MiniAppChainContracts;
    uiConfig?: MiniAppRuntimeConfig | null;
    display?: MiniAppDisplayConfig | null;
    debug?: boolean;
  };
  invokeRead?: (params: {
    contract?: string;
    method?: string;
    args?: unknown[];
    chainId?: ChainId;
    chainType?: ChainType;
  }) => Promise<unknown>;
  invokeFunction?: (params: {
    contract?: string;
    method?: string;
    args?: unknown[];
    chainId?: ChainId;
    chainType?: ChainType;
  }) => Promise<unknown>;
  getAddress?: () => Promise<string>;
  wallet: {
    getAddress: () => Promise<string>;
    switchChain?: (chainId: ChainId) => Promise<void>;
    invokeIntent?: (requestId: string) => Promise<{ tx_hash: string }>;
    signMessage?: (message: string) => Promise<unknown>;
  };
  payments: {
    payGAS: (appId: string, amount: string, memo?: string) => Promise<PayGASResponse>;
    payGASAndInvoke?: (appId: string, amount: string, memo?: string) => Promise<PayGASResponse>;
  };
  governance: {
    vote: (
      appId: string,
      proposalId: string,
      neoAmount: string,
      support?: boolean
    ) => Promise<VoteBNEOResponse>;
    voteAndInvoke?: (
      appId: string,
      proposalId: string,
      neoAmount: string,
      support?: boolean
    ) => Promise<VoteBNEOResponse>;
    getCandidates: () => Promise<CandidatesResponse>;
  };
  rng: {
    requestRandom: (appId: string) => Promise<RNGResponse>;
  };
  datafeed: {
    getPrice: (symbol: string) => Promise<PriceResponse>;
    getPrices?: () => Promise<PricesResponse>;
    getNetworkStats?: () => Promise<NetworkStatsResponse>;
    getRecentTransactions?: (limit?: number) => Promise<RecentTransactionsResponse>;
  };
  stats?: {
    getMyUsage: (appId: string, date?: string) => Promise<MiniAppUsageResponse>;
  };
  events?: {
    list: (params: EventsListParams) => Promise<EventsListResponse>;
  };
  transactions?: {
    list: (params: TransactionsListParams) => Promise<TransactionsListResponse>;
  };
}
