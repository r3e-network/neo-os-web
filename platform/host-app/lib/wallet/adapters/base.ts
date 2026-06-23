/**
 * Base wallet adapter interface for Neo N3 wallets
 * Follows Interface Segregation Principle (ISP)
 */

import type { NeoNetwork } from "@/lib/neo-network";

export type NeoWalletNetwork = NeoNetwork;

export interface WalletAccount {
  address: string;
  /** Neo N3 account script hash (Hash160) when the wallet exposes it. */
  accountHash?: string;
  publicKey: string;
  label?: string;
  network?: NeoWalletNetwork | null;
}

export interface WalletBalance {
  neo: string;
  gas: string;
}

export interface TransactionResult {
  txid: string;
  nodeUrl?: string;
}

export interface SignedMessage {
  publicKey: string;
  data: string;
  salt: string;
  message: string;
}

export interface InvokeParams {
  scriptHash: string;
  operation: string;
  args: Array<{ type: string; value: unknown }>;
  signers?: Array<{
    account: string;
    scopes: number;
    allowedContracts?: string[];
    allowedGroups?: string[];
  }>;
}

export interface WalletAdapter {
  readonly name: string;
  readonly icon: string;
  readonly downloadUrl: string;

  /** Check if wallet extension is installed */
  isInstalled(): boolean;

  /** Connect to wallet and get account */
  connect(): Promise<WalletAccount>;

  /**
   * Reconnect to an already-authorized account without prompting the user
   * (e.g. via the dAPI `getAccounts` call). Resolves `null` when the wallet
   * has no silently readable account; implementations must never trigger an
   * authentication prompt from this path.
   */
  connectSilently?(): Promise<WalletAccount | null>;

  /** Disconnect from wallet */
  disconnect(): Promise<void>;

  /** Get current account balance */
  getBalance(address: string): Promise<WalletBalance>;

  /** Sign a message */
  signMessage(message: string): Promise<SignedMessage>;

  /** Return the currently selected Neo N3 network when the wallet exposes it. */
  getNetwork?(): Promise<NeoWalletNetwork | null>;

  /** Invoke a smart contract */
  invoke(params: InvokeParams): Promise<TransactionResult>;

  /** Invoke multiple contracts in one wallet transaction when the provider supports NEP-21 batching */
  invokeMultiple?(
    params: InvokeParams[],
    signers?: InvokeParams["signers"],
  ): Promise<TransactionResult>;

  /** Send a native or NEP asset transfer when the wallet exposes a direct transfer lane */
  send?(
    asset: string,
    amount: string | number,
    to: string,
    from?: string,
  ): Promise<TransactionResult>;

  /** Subscribe to wallet account changes when supported by the provider */
  onAccountChanged?(listener: () => void | Promise<void>): () => void;

  /** Subscribe to wallet network changes when supported by the provider */
  onNetworkChanged?(listener: () => void | Promise<void>): () => void;
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
