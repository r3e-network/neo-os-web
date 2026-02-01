import type { ChainId, ChainType } from "../../chains/types";

/**
 * Base wallet adapter interfaces for Neo N3 support.
 * Follows Interface Segregation Principle (ISP).
 */

export interface WalletAccount {
  address: string;
  publicKey: string;
  label?: string;
  /** Chain ID this account is connected to */
  chainId?: ChainId;
}

/**
 * Wallet balance structure (Neo N3).
 * - native = GAS
 * - governance = NEO
 */
export interface WalletBalance {
  /** Native currency balance (GAS) */
  native: string;
  /** Native currency symbol */
  nativeSymbol: string;
  /** Governance token balance (NEO) */
  governance?: string;
  /** Governance token symbol */
  governanceSymbol?: string;
  /** Additional token balances keyed by contract address */
  tokens?: Record<string, TokenBalance>;
}

/** Token balance info */
export interface TokenBalance {
  symbol: string;
  balance: string;
  decimals: number;
}

/**
 * Legacy Neo N3 balance format for backward compatibility
 * @deprecated Use WalletBalance instead
 */
export interface LegacyNeoBalance {
  neo: string;
  gas: string;
}

/** Convert legacy Neo balance to multi-chain format */
export function toLegacyNeoBalance(balance: WalletBalance): LegacyNeoBalance {
  return {
    neo: balance.governance || "0",
    gas: balance.native,
  };
}

/** Convert legacy Neo balance from multi-chain format */
export function fromLegacyNeoBalance(legacy: LegacyNeoBalance): WalletBalance {
  return {
    native: legacy.gas,
    nativeSymbol: "GAS",
    governance: legacy.neo,
    governanceSymbol: "NEO",
  };
}

export interface TransactionResult {
  txid: string;
  nodeUrl?: string;
  /** Chain type where transaction was executed */
  chainType?: ChainType;
}

export interface SignedMessage {
  publicKey: string;
  data: string;
  salt: string;
  message: string;
}

/**
 * Neo N3 specific invoke parameters
 */
export interface NeoInvokeParams {
  scriptHash: string;
  operation: string;
  args: Array<{ type: string; value: unknown }>;
  signers?: Array<{
    account: string;
    scopes: number;
    allowedContracts?: string[];
  }>;
}

/**
 * Legacy InvokeParams for backward compatibility (Neo N3)
 * @deprecated Use NeoInvokeParams
 */
export type InvokeParams = NeoInvokeParams;

export interface WalletAdapter {
  readonly name: string;
  readonly icon: string;
  readonly downloadUrl: string;
  /** Supported chain types */
  readonly supportedChainTypes: readonly ChainType[];

  /** Check if wallet extension is installed */
  isInstalled(): boolean;

  /** Connect to wallet and get account */
  connect(): Promise<WalletAccount>;

  /** Disconnect from wallet */
  disconnect(): Promise<void>;

  /** Get current account balance for specified chain */
  getBalance(address: string, chainId: ChainId): Promise<WalletBalance>;

  /** Sign a message */
  signMessage(message: string): Promise<SignedMessage>;

  /** Invoke a smart contract (Neo N3) */
  invoke(params: InvokeParams): Promise<TransactionResult>;
}

/** Wallet connection error types */
export class WalletNotInstalledError extends Error {
  constructor(walletName: string) {
    super(`${walletName} wallet is not installed`);
    this.name = "WalletNotInstalledError";
  }
}

export class WalletConnectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WalletConnectionError";
  }
}

export class WalletTransactionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WalletTransactionError";
  }
}
