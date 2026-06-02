import type { Ref } from "vue";

import type { NeoDapiProvider as BaseNeoDapiProvider } from "./nep21-provider";

// Re-export types that were previously in @neo/types
export interface WalletSDK {
  address: Ref<string | null>;
  chainType: Ref<string>;
  /** Connected chain ID (e.g. "neo-n3-mainnet", "neo-n3-testnet") */
  chainId?: Ref<string>;
  /** App-specific chain ID override (e.g. for AA-based apps) */
  appChainId?: Ref<string>;
  connect: () => Promise<void>;
  invokeWithConfirmation?: (
    params: InvokeParams,
    context?: WalletIntentConfirmationContext,
  ) => Promise<InvokeResult>;
  invokeContract: (params: InvokeParams) => Promise<InvokeResult>;
  invokeMultiple: (params: BatchInvokeParams) => Promise<InvokeResult>;
  invokeRead: (params: InvokeParams) => Promise<InvokeResult>;
  getBalance: (asset: string) => Promise<string | number>;
  send?: (
    asset: string,
    amount: string | number,
    to: string,
    from?: string,
  ) => Promise<InvokeResult>;
  getContractAddress: () => Promise<string>;
  /** Sign a message with the connected wallet */
  signMessage?: (message: string) => Promise<{
    publicKey?: string;
    data?: string;
    signature?: string;
    account?: string;
    pubkey?: string;
  } | null>;
  /** Switch the wallet to a different chain/network */
  switchToAppChain?: (chainId: string) => Promise<void>;
}

export interface InvokeParams {
  scriptHash: string;
  operation: string;
  args?: ContractArg[];
  signers?: WalletSigner[];
}

export interface WalletIntentConfirmationContext {
  endpoint?: string;
  appId?: string;
  title?: string;
  [key: string]: unknown;
}

export type WalletIntentConfirmationHook = (
  params: InvokeParams,
  context?: WalletIntentConfirmationContext,
) => boolean | Promise<boolean>;

export interface BatchInvokeParams {
  invokeArgs: InvokeParams[];
  signers?: WalletSigner[];
}

export interface ContractArg {
  type: string;
  value: unknown;
}

export interface WalletSigner {
  account: string;
  scopes: string | number;
  allowedContracts?: string[];
  allowedGroups?: string[];
  rules?: unknown[];
}

export interface InvokeResult {
  stack?: StackItem[];
  state?: string;
  gasconsumed?: string;
  exception?: string | null;
  tx?: string;
  txid?: string;
}

export interface StackItem {
  type: string;
  value: unknown;
}

export interface GameState {
  wins: number;
  losses: number;
  totalGames: number;
}

export interface EventsListParams {
  app_id?: string;
  event_name?: string;
  limit?: number;
  offset?: number;
  tx_hash?: string;
}

export interface EventsListResponse {
  events: ContractEvent[];
  total?: number;
}

export interface ContractEvent {
  id: string | number;
  event_name: string;
  state: unknown;
  tx_hash?: string;
  created_at?: string;
  block_index?: number;
}

export type NeoDapiProvider = BaseNeoDapiProvider<ContractArg, InvokeResult>;

export type ActiveWalletProvider = {
  kind: "nep21";
  provider: NeoDapiProvider;
};

export type MiniAppManifest = {
  id?: string;
  contracts?: Record<string, string>;
  default_network?: string;
};

declare global {
  interface Window {
    NEP21Provider?: NeoDapiProvider;
    NEP21Providers?: Record<string, NeoDapiProvider>;
    OneGateDapiProvider?: NeoDapiProvider;
    Neo?: { DapiProvider?: NeoDapiProvider };
    neoDapiProvider?: NeoDapiProvider;
    neoDapi?: NeoDapiProvider;
    NeoMiniAppWalletConfirmIntent?: WalletIntentConfirmationHook;
  }
}
