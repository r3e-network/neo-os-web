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
  intent: "vote";
  constraints: { settlement: "NATIVE_TOKEN" };
  chain_id: ChainId;
  chain_type: ChainType;
  invocation: InvocationIntent;
  txid?: string | null;
  receipt_id?: string | null;
}

export interface InvocationIntent {
  script: string;
  script_hash: string;
  operation: string;
  args?: (string | number | boolean | null)[];
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

export interface WalletSDK {
  address: import("vue").Ref<string | null>;
  chainType: import("vue").Ref<ChainType>;
  chainId: import("vue").Ref<string>;
  isConnected: import("vue").Ref<boolean>;
  connect: () => Promise<string | null>;
  disconnect: () => void;
  invokeRead: (options: {
    contractAddress: string;
    operation: string;
    args?: unknown[];
  }) => Promise<unknown>;
  invokeContract: (options: {
    scriptHash: string;
    operation: string;
    args?: unknown[];
  }) => Promise<{ txid: string; receiptId?: string }>;
  switchChain: (chainType: ChainType) => Promise<boolean>;
  getContractAddress: () => Promise<string | null>;
  formatAddress: (address: string, options?: { length?: number }) => string;
  parseAddress: (address: string) => string;
}

export interface EventsSDK {
  list: (options: {
    app_id: string;
    event_name: string;
    limit?: number;
    after_id?: string;
  }) => Promise<{
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
  payGAS: (
    amount: string,
    memo: string,
  ) => Promise<PaymentResult>;
}
