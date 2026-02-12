/**
 * Neo MiniApp TypeScript Types
 *
 * This package provides TypeScript types for Neo MiniApps.
 * Types are maintained in sync with @neo/uniapp-sdk.
 */

export type ChainType = "neo-n3";
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
  constraints: { governance: "BNEO_ONLY" | "NEO_ONLY" };
  chain_id: ChainId;
  chain_type: ChainType;
  invocation: InvocationIntent;
  txid?: string | null;
  receipt_id?: string | null;
}

export interface InvocationIntent {
  chain_id: ChainId;
  chain_type: ChainType;
  contract_address: string;
  method: string;
  params?: unknown[];
  args?: unknown[];
}

export interface PaymentResult {
  receipt_id: string;
  request_id: string;
  txid?: string;
}

export interface PaymentState {
  status: "pending" | "processing" | "completed" | "failed";
  amount: string;
  currency: string;
  txid?: string;
  receipt_id?: string;
  error?: string;
}

/** Contract invocation parameters — accepts multiple naming conventions for flexibility */
export interface ContractInvokeOptions {
  /** Script hash of the contract (canonical Neo N3 identifier) */
  scriptHash?: string;
  /** Alias for scriptHash */
  contractAddress?: string;
  /** Alias for scriptHash */
  contractHash?: string;
  /** Contract method / operation name */
  method?: string;
  /** Alias for method */
  operation?: string;
  /** Invocation arguments */
  args?: unknown[];
  /** Target chain */
  chainId?: ChainId;
  /** Chain type */
  chainType?: ChainType;
  /** Allow additional provider-specific options */
  [key: string]: unknown;
}

export interface WalletSDK {
  address: import("vue").Ref<string | null>;
  chainType: import("vue").Ref<ChainType | null>;
  chainId: import("vue").Ref<string | null>;
  isConnected: import("vue").Ref<boolean>;
  connect: () => Promise<void>;
  invokeRead: (options: ContractInvokeOptions) => Promise<unknown>;
  invokeContract: (
    options: ContractInvokeOptions & { args: unknown[] }
  ) => Promise<{ txid: string; receiptId?: string }>;
  invokeIntent: (requestId: string) => Promise<unknown>;
  signMessage: (message: string) => Promise<unknown>;
  switchChain: (chainId: string) => Promise<void>;
  getContractAddress: () => Promise<string | null>;
  getBalance: (token?: string) => Promise<string | Record<string, string>>;
  getTransactions: (limit?: number) => Promise<unknown[]>;
}

export interface EventsSDK {
  list: (options: { app_id: string; event_name: string; limit?: number; after_id?: string }) => Promise<{
    events: Array<{
      id: string;
      state: Record<string, unknown>;
      created_at: string;
    }>;
    has_more: boolean;
    last_id: string;
  }>;
  emit: (event: string, data: unknown) => void;
}

export interface PaymentsSDK {
  payGAS: (amount: string, memo: string) => Promise<PaymentResult>;
}

/** Result from a contract invocation */
export interface InvokeResult {
  txid: string;
  txHash?: string;
  receiptId?: string;
}

/** Async operation options for composables */
export interface AsyncOperationOptions {
  /** Context label for error messages */
  context?: string;
  /** Timeout in milliseconds */
  timeoutMs?: number;
  /** Error callback */
  onError?: (error: Error) => void;
  /** Success callback */
  onSuccess?: (data: unknown) => void;
  /** Whether to set loading state (default: true) */
  setLoading?: boolean;
  /** Whether to rethrow errors (default: false) */
  rethrow?: boolean;
}

/** Result of an async operation */
export type AsyncOperationResult<T> = { success: true; data: T } | { success: false; error: Error };

/** State shape for async operations */
export interface AsyncOperationState {
  isLoading: boolean;
  error: Error | null;
}

/** Game state for game-like miniapps */
export interface GameState {
  wins: number;
  losses: number;
  totalGames: number;
  winRate: number;
}

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
