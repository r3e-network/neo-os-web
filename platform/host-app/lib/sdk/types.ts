/**
 * MiniApp SDK Types
 */

import type { ChainId } from "../chains/types";

export type MiniAppChainContract = {
  address: string | null;
  active?: boolean;
  entryUrl?: string;
};

export type MiniAppChainContracts = Record<ChainId, MiniAppChainContract>;

export interface MiniAppSDKConfig {
  edgeBaseUrl?: string;
  appId?: string;
  /** @deprecated Use chainId instead */
  network?: "testnet" | "mainnet";
  /** Multi-chain support, null if app has no chain support */
  chainId?: ChainId | null;
  chainType?: "neo-n3" | "evm";
  /** Active chain contract address, if configured */
  contractAddress?: string | null;
  /** Supported chains for this MiniApp */
  supportedChains?: ChainId[];
  /** Per-chain contract metadata */
  chainContracts?: MiniAppChainContracts;
  layout?: "web" | "mobile";
  getAuthToken?: () => Promise<string | undefined>;
  getAPIKey?: () => Promise<string | undefined>;
}

// SDK sub-module interfaces - all methods optional for dynamic building
export interface SDKWallet {
  getAddress?: () => Promise<string>;
  invokeIntent?: (requestId: string) => Promise<unknown>;
  switchChain?: (chainId: ChainId) => Promise<void>;
  signMessage?: (message: string) => Promise<unknown>;
}

export interface SDKPayments {
  payGAS?: (targetAppId: string, amount: string, memo?: string) => Promise<unknown>;
  payGASAndInvoke?: (targetAppId: string, amount: string, memo?: string) => Promise<unknown>;
}

export interface SDKGovernance {
  vote?: (targetAppId: string, proposalId: string, neoAmount: string, support?: boolean) => Promise<unknown>;
  voteAndInvoke?: (targetAppId: string, proposalId: string, neoAmount: string, support?: boolean) => Promise<unknown>;
  getCandidates?: () => Promise<unknown>;
}

export interface SDKRNG {
  requestRandom?: (targetAppId: string) => Promise<unknown>;
}

export interface SDKDatafeed {
  getPrice?: (symbol: string) => Promise<unknown>;
  getPrices?: () => Promise<unknown>;
  getNetworkStats?: () => Promise<unknown>;
  getRecentTransactions?: (limit?: number) => Promise<unknown>;
}

export interface SDKStats {
  getMyUsage?: (targetAppId?: string, date?: string) => Promise<unknown>;
}

export interface SDKEvents {
  list?: (params?: Record<string, unknown>) => Promise<unknown>;
  emit?: (eventName: string, data?: Record<string, unknown>) => Promise<unknown>;
}

export interface SDKTransactions {
  list?: (params?: Record<string, unknown>) => Promise<unknown>;
}

export interface SDKNotifications {
  send?: (title: string, message: string, opts?: Record<string, unknown>) => Promise<unknown>;
  list?: (params?: Record<string, unknown>) => Promise<unknown>;
}

export interface SDKAutomation {
  register?: (
    taskName: string,
    taskType: string,
    payload?: Record<string, unknown>,
    schedule?: { intervalSeconds?: number; maxRuns?: number },
  ) => Promise<unknown>;
  unregister?: (taskName: string) => Promise<unknown>;
  status?: (taskName: string) => Promise<unknown>;
  list?: () => Promise<unknown>;
  update?: (
    taskId: string,
    payload?: Record<string, unknown>,
    schedule?: { intervalSeconds?: number; cron?: string; maxRuns?: number },
  ) => Promise<unknown>;
  enable?: (taskId: string) => Promise<unknown>;
  disable?: (taskId: string) => Promise<unknown>;
  logs?: (taskId?: string, limit?: number) => Promise<unknown>;
  cancel?: (taskId: string) => Promise<unknown>;
}

export interface MiniAppSDK {
  invoke?: (method: string, params?: unknown) => Promise<unknown>;
  getConfig?: () => {
    appId: string;
    chainId?: ChainId | null;
    chainType?: "neo-n3" | "evm";
    contractAddress?: string | null;
    supportedChains?: ChainId[];
    chainContracts?: MiniAppChainContracts;
    layout?: "web" | "mobile";
    debug: boolean;
  };
  getAddress?: () => Promise<string>;
  wallet?: SDKWallet;
  payments?: SDKPayments;
  governance?: SDKGovernance;
  rng?: SDKRNG;
  datafeed?: SDKDatafeed;
  stats?: SDKStats;
  events?: SDKEvents;
  transactions?: SDKTransactions;
  notifications?: SDKNotifications;
  automation?: SDKAutomation;
}
