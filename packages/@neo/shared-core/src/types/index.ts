/**
 * Shared types - Platform agnostic
 */

/** Neo network types */
export type NeoNetwork = "MainNet" | "TestNet" | "N3MainNet" | "N3TestNet";

/** Wallet state */
export interface WalletState {
  connected: boolean;
  address: string | null;
  publicKey: string | null;
  network: NeoNetwork;
}

/** Transaction status */
export type TransactionStatus = "pending" | "confirmed" | "failed";

/** Transaction result */
export interface TransactionResult {
  txid: string;
  status: TransactionStatus;
  blockHeight?: number;
  gasConsumed?: string;
}

/** Asset balance */
export interface AssetBalance {
  asset: string;
  symbol: string;
  amount: string;
  decimals: number;
}

/** Contract invocation argument */
export interface ContractArg {
  type: "String" | "Integer" | "Boolean" | "Hash160" | "Hash256" | "ByteArray" | "Array";
  value: unknown;
}

/** Contract invocation request */
export interface ContractInvocation {
  scriptHash: string;
  operation: string;
  args: ContractArg[];
}

/** MiniApp metadata */
export interface MiniAppMetadata {
  id: string;
  name: string;
  description: string;
  icon: string;
  version: string;
  author: string;
  category: string;
  tags: string[];
}
