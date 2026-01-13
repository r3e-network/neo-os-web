import type { ChainId, ChainType } from "../../chains/types";

/**
 * Base wallet adapter interfaces for multi-chain support
 * Supports Neo N3, NeoX, Ethereum, and other EVM-compatible chains
 * Follows Interface Segregation Principle (ISP)
 */

export interface WalletAccount {
  address: string;
  publicKey: string;
  label?: string;
  /** Chain ID this account is connected to */
  chainId?: ChainId;
}

/**
 * Multi-chain wallet balance structure
 * - For Neo N3: native = GAS, governance = NEO
 * - For EVM chains: native = ETH/GAS/etc, governance = undefined
 */
export interface WalletBalance {
  /** Native currency balance (GAS for Neo N3, ETH for Ethereum, etc.) */
  native: string;
  /** Native currency symbol */
  nativeSymbol: string;
  /** Governance token balance (NEO for Neo N3, undefined for most EVM chains) */
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
 * EVM specific transaction parameters
 */
export interface EVMTransactionParams {
  to: string;
  value?: string;
  data?: string;
  gasLimit?: string;
  gasPrice?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
}

/**
 * Legacy InvokeParams for backward compatibility (Neo N3)
 * @deprecated Use NeoInvokeParams or EVMTransactionParams
 */
export interface InvokeParams extends NeoInvokeParams {}

/**
 * Union type for multi-chain invoke parameters
 */
export type MultiChainInvokeParams =
  | { chainType: "neo-n3"; params: NeoInvokeParams }
  | { chainType: "evm"; params: EVMTransactionParams };

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

/**
 * EVM-specific wallet adapter interface
 */
export interface EVMWalletAdapter {
  readonly name: string;
  readonly icon: string;
  readonly downloadUrl: string;
  readonly supportedChainTypes: readonly ChainType[];

  /** Check if wallet is available */
  isAvailable(): boolean;

  /** Connect to wallet on specific chain */
  connect(chainId: ChainId): Promise<WalletAccount & { balance?: { native: string } }>;

  /** Disconnect from wallet */
  disconnect(): Promise<void>;

  /** Get balance for address on chain */
  getBalance(address: string, chainId: ChainId): Promise<WalletBalance>;

  /** Sign a message */
  signMessage(message: string): Promise<string>;

  /** Send EVM transaction */
  sendTransaction(params: EVMTransactionParams): Promise<TransactionResult>;

  /** Switch to different chain */
  switchChain(chainId: ChainId): Promise<void>;

  /** Add chain to wallet if not present */
  addChain?(chainId: ChainId): Promise<void>;
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
