/**
 * Multi-Chain Wallet Adapter Interface
 *
 * Base interface for all chain-specific wallet adapters.
 */

import type { ChainId, ChainType, ChainAccount, TransactionRequest, TransactionResult } from "../../chains/types";

// ============================================================================
// Wallet Adapter Interface
// ============================================================================

export interface WalletAdapterEvents {
  connect: (account: ChainAccount) => void;
  disconnect: () => void;
  accountChanged: (account: ChainAccount) => void;
  chainChanged: (chainId: ChainId) => void;
  error: (error: Error) => void;
}

export interface IWalletAdapter {
  /** Adapter identifier */
  readonly id: string;

  /** Human-readable name */
  readonly name: string;

  /** Supported chain type */
  readonly chainType: ChainType;

  /** Whether the wallet is installed/available */
  isAvailable(): boolean;

  /** Whether currently connected */
  isConnected(): boolean;

  /** Connect to wallet */
  connect(chainId: ChainId): Promise<ChainAccount>;

  /** Disconnect from wallet */
  disconnect(): Promise<void>;

  /** Get current account */
  getAccount(): ChainAccount | null;

  /** Switch to a different chain */
  switchChain(chainId: ChainId): Promise<void>;

  /** Sign a message */
  signMessage(message: string): Promise<string>;

  /** Send a transaction */
  sendTransaction(request: TransactionRequest): Promise<TransactionResult>;

  /** Subscribe to events */
  on<K extends keyof WalletAdapterEvents>(event: K, callback: WalletAdapterEvents[K]): void;

  /** Unsubscribe from events */
  off<K extends keyof WalletAdapterEvents>(event: K, callback: WalletAdapterEvents[K]): void;
}
