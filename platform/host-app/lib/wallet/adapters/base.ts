/**
 * Base wallet adapter interface for Neo N3 wallets
 * Follows Interface Segregation Principle (ISP)
 */

export interface WalletAccount {
  address: string;
  publicKey: string;
  label?: string;
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

  /** Disconnect from wallet */
  disconnect(): Promise<void>;

  /** Get current account balance */
  getBalance(address: string): Promise<WalletBalance>;

  /** Sign a message */
  signMessage(message: string): Promise<SignedMessage>;

  /** Invoke a smart contract */
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
