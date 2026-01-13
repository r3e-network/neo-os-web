/**
 * Multi-Chain Configuration Types
 *
 * Core type definitions for the multi-chain platform.
 * Supports Neo N3, NeoX (EVM), Ethereum, and extensible to other chains.
 */

// ============================================================================
// Chain Type Definitions
// ============================================================================

/**
 * Supported chain types
 */
export type ChainType = "neo-n3" | "evm";

/**
 * Chain identifiers - unique string IDs for each supported chain
 */
export type ChainId =
  | "neo-n3-mainnet"
  | "neo-n3-testnet"
  | "neox-mainnet"
  | "neox-testnet"
  | "ethereum-mainnet"
  | "ethereum-sepolia"
  | string; // Allow custom chain IDs for extensibility

/**
 * EVM Chain IDs (numeric)
 */
export const EVM_CHAIN_IDS = {
  "neox-mainnet": 47763,
  "neox-testnet": 12227332,
  "ethereum-mainnet": 1,
  "ethereum-sepolia": 11155111,
} as const;

/**
 * Neo N3 Network Magic Numbers
 */
export const NEO_NETWORK_MAGIC = {
  "neo-n3-mainnet": 860833102,
  "neo-n3-testnet": 894710606,
} as const;

// ============================================================================
// Chain Configuration
// ============================================================================

/**
 * Base chain configuration shared by all chain types
 */
export interface BaseChainConfig {
  /** Unique chain identifier */
  id: ChainId;
  /** Human-readable chain name */
  name: string;
  /** Localized name (Chinese) */
  nameZh: string;
  /** Chain type for protocol handling */
  type: ChainType;
  /** Whether this is a testnet */
  isTestnet: boolean;
  /** Chain status */
  status: "active" | "deprecated" | "maintenance";
  /** Chain icon/logo URL */
  icon: string;
  /** Chain color for UI theming */
  color: string;
  /** Native currency symbol */
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  /** Block explorer URL */
  explorerUrl: string;
  /** Average block time in seconds */
  blockTime: number;
  /** Chain creation timestamp */
  createdAt: string;
  /** Last update timestamp */
  updatedAt: string;
}

/**
 * Neo N3 specific chain configuration
 */
export interface NeoN3ChainConfig extends BaseChainConfig {
  type: "neo-n3";
  /** Neo network magic number */
  networkMagic: number;
  /** RPC endpoints */
  rpcUrls: string[];
  /** Neo-specific contract addresses */
  contracts: {
    neo: string;
    gas: string;
    policy: string;
    roleManagement: string;
    oracle: string;
    nameService?: string;
  };
}

/**
 * EVM chain configuration
 */
export interface EVMChainConfig extends BaseChainConfig {
  type: "evm";
  /** EVM chain ID (numeric) */
  chainId: number;
  /** RPC endpoints */
  rpcUrls: string[];
  /** WebSocket RPC endpoints */
  wsUrls?: string[];
  /** Alchemy API configuration */
  alchemy?: {
    apiKey: string;
    network: string;
  };
  /** Common contract addresses */
  contracts: {
    multicall3?: string;
    ensRegistry?: string;
  };
}

/**
 * Union type for all chain configurations
 */
export type ChainConfig = NeoN3ChainConfig | EVMChainConfig;

// ============================================================================
// Wallet Provider Types
// ============================================================================

/**
 * Wallet provider types by chain type
 */
export type NeoWalletProvider = "neoline" | "o3" | "onegate" | "auth0";
export type EVMWalletProvider = "metamask" | "walletconnect" | "auth0";
export type WalletProviderType = NeoWalletProvider | EVMWalletProvider;

/**
 * Wallet provider configuration
 */
export interface WalletProviderConfig {
  id: WalletProviderType;
  name: string;
  icon: string;
  supportedChainTypes: ChainType[];
  downloadUrl?: string;
  deepLink?: string;
}

// ============================================================================
// Multi-Chain Account Types
// ============================================================================

/**
 * Chain-specific account information
 */
export interface ChainAccount {
  chainId: ChainId;
  address: string;
  publicKey?: string;
  balance?: {
    native: string;
    tokens?: Record<string, string>;
  };
}

/**
 * Unified multi-chain account
 */
export interface MultiChainAccount {
  /** Primary identifier (could be social ID or primary address) */
  id: string;
  /** Account type */
  type: "social" | "external";
  /** Connected wallet provider */
  provider: WalletProviderType;
  /** Accounts per chain */
  accounts: Record<ChainId, ChainAccount>;
  /** Active chain */
  activeChainId: ChainId;
  /** HD derivation path (for social accounts) */
  derivationPath?: string;
}

// ============================================================================
// Transaction Types
// ============================================================================

/**
 * Base transaction request
 */
export interface BaseTransactionRequest {
  chainId: ChainId;
  from: string;
}

/**
 * Neo N3 transaction request
 */
export interface NeoTransactionRequest extends BaseTransactionRequest {
  scriptHash: string;
  operation: string;
  args: Array<{
    type: string;
    value: string | number | boolean;
  }>;
  signers?: Array<{
    account: string;
    scopes: string;
    allowedContracts?: string[];
    allowedGroups?: string[];
  }>;
}

/**
 * EVM transaction request
 */
export interface EVMTransactionRequest extends BaseTransactionRequest {
  to: string;
  value?: string;
  data?: string;
  gasLimit?: string;
  gasPrice?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  nonce?: number;
}

/**
 * Union type for transaction requests
 */
export type TransactionRequest = NeoTransactionRequest | EVMTransactionRequest;

/**
 * Transaction result
 */
export interface TransactionResult {
  chainId: ChainId;
  txHash: string;
  status: "pending" | "confirmed" | "failed";
  blockNumber?: number;
  gasUsed?: string;
  error?: string;
}

// ============================================================================
// Event Types
// ============================================================================

/**
 * Chain event subscription
 */
export interface ChainEventSubscription {
  chainId: ChainId;
  contractAddress: string;
  eventName: string;
  filter?: Record<string, unknown>;
}

/**
 * Chain event
 */
export interface ChainEvent {
  chainId: ChainId;
  contractAddress: string;
  eventName: string;
  blockNumber: number;
  txHash: string;
  data: Record<string, unknown>;
  timestamp: number;
}

// ============================================================================
// Type Guards
// ============================================================================

export function isNeoN3Chain(config: ChainConfig): config is NeoN3ChainConfig {
  return config.type === "neo-n3";
}

export function isEVMChain(config: ChainConfig): config is EVMChainConfig {
  return config.type === "evm";
}

export function isNeoTransactionRequest(request: TransactionRequest): request is NeoTransactionRequest {
  return "scriptHash" in request && "operation" in request;
}

export function isEVMTransactionRequest(request: TransactionRequest): request is EVMTransactionRequest {
  return "to" in request;
}
