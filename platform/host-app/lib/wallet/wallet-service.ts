/**
 * Unified Wallet Service - Abstraction Layer
 *
 * MiniApps interact with this service without knowing whether
 * the underlying provider is a social account or extension wallet.
 *
 * - Social Account: Password-based signing (encrypted key in DB)
 * - Extension Wallet: Browser extension signing (NeoLine, O3, OneGate)
 */

import type { InvokeParams, TransactionResult, SignedMessage, WalletBalance } from "./adapters/base";

/**
 * Wallet provider type - abstracted from MiniApps
 */
export type WalletProviderType = "social" | "extension";

/**
 * Unified wallet account info
 */
export interface UnifiedWalletAccount {
  address: string;
  publicKey: string;
  providerType: WalletProviderType;
  providerName: string;
  label?: string;
}

/**
 * Sign request - provider-agnostic
 */
export interface SignRequest {
  message: string;
  /** Optional: pre-provided password for social accounts (skip UI prompt) */
  password?: string;
}

/**
 * Invoke request - provider-agnostic
 */
export interface InvokeRequest {
  scriptHash: string;
  operation: string;
  args: Array<{ type: string; value: unknown }>;
  signers?: Array<{
    account: string;
    scopes: number;
    allowedContracts?: string[];
  }>;
  /** Optional: pre-provided password for social accounts (skip UI prompt) */
  password?: string;
}

/**
 * Wallet service events
 */
export type WalletEventType = "connected" | "disconnected" | "accountChanged" | "balanceChanged" | "passwordRequired";

export interface WalletEvent {
  type: WalletEventType;
  data?: unknown;
}

export type WalletEventListener = (event: WalletEvent) => void;

/**
 * Password request callback - UI layer implements this
 */
export type PasswordRequestCallback = () => Promise<string>;

/**
 * Unified Wallet Service Interface
 *
 * MiniApps use this interface - they don't need to know
 * if it's a social account or extension wallet underneath.
 */
export interface IWalletService {
  // Connection state
  readonly isConnected: boolean;
  readonly account: UnifiedWalletAccount | null;
  readonly providerType: WalletProviderType | null;

  // Core operations (provider-agnostic)
  getAddress(): Promise<string>;
  getBalance(): Promise<WalletBalance>;
  signMessage(request: SignRequest): Promise<SignedMessage>;
  invoke(request: InvokeRequest): Promise<TransactionResult>;

  // Connection management
  connect(providerType: WalletProviderType, providerName?: string): Promise<UnifiedWalletAccount>;
  disconnect(): Promise<void>;

  // Event handling
  on(event: WalletEventType, listener: WalletEventListener): void;
  off(event: WalletEventType, listener: WalletEventListener): void;

  // Password handling (for social accounts)
  setPasswordCallback(callback: PasswordRequestCallback): void;
}

/**
 * Error types for wallet operations
 */
export class WalletNotConnectedError extends Error {
  constructor() {
    super("Wallet not connected");
    this.name = "WalletNotConnectedError";
  }
}

export class WalletPasswordRequiredError extends Error {
  constructor() {
    super("Password required for social account signing");
    this.name = "WalletPasswordRequiredError";
  }
}

export class WalletUserCancelledError extends Error {
  constructor() {
    super("User cancelled the operation");
    this.name = "WalletUserCancelledError";
  }
}

export class WalletInsufficientFundsError extends Error {
  constructor(required: string, available: string) {
    super(`Insufficient funds: required ${required}, available ${available}`);
    this.name = "WalletInsufficientFundsError";
  }
}

export class WalletTransactionFailedError extends Error {
  constructor(reason: string) {
    super(`Transaction failed: ${reason}`);
    this.name = "WalletTransactionFailedError";
  }
}
