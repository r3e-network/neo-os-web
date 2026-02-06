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
  invoke(params: NeoInvokeParams): Promise<TransactionResult>;
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
