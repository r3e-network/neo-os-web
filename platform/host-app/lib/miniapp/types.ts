/**
 * Neo N3 Miniapp Configuration Types
 *
 * Extended miniapp configuration supporting Neo N3 networks.
 */

import type { ChainId } from "../chains/types";

// ============================================================================
// Multi-Chain Contract Configuration
// ============================================================================

/**
 * Contract configuration for a specific chain
 */
export interface ChainContractConfig {
  /** Chain identifier */
  chainId: ChainId;
  /** Contract address/hash */
  contractAddress: string;
  /** Optional contract ABI (if available) */
  abi?: string;
  /** Whether this chain is the primary/default */
  isPrimary?: boolean;
  /** Chain-specific settings */
  settings?: Record<string, unknown>;
}

/**
 * Multi-chain contract mapping
 */
export type MultiChainContracts = Record<ChainId, ChainContractConfig>;

// ============================================================================
// Miniapp Permissions
// ============================================================================

export interface MiniappPermissions {
  payments: boolean;
  governance: boolean;
  rng: boolean;
  datafeed: boolean;
  automation: boolean;
  /** Reserved for cross-chain operations (not used in Neo-only mode) */
  crossChain?: boolean;
}

// ============================================================================
// Multi-Chain Miniapp Configuration
// ============================================================================

export interface MultiChainMiniappConfig {
  /** Unique app identifier */
  appId: string;
  /** App name */
  name: string;
  /** Localized name */
  nameZh?: string;
  /** Description */
  description: string;
  /** Localized description */
  descriptionZh?: string;
  /** App icon URL */
  icon: string;
  /** Entry URL */
  entryUrl: string;
  /** Category */
  category: "gaming" | "defi" | "social" | "governance" | "utility" | "nft";
  /** Status */
  status: "active" | "inactive" | "beta";
  /** Supported chains */
  supportedChains: ChainId[];
  /** Contract configurations per chain */
  contracts: MultiChainContracts;
  /** Permissions */
  permissions: MiniappPermissions;
  /** Stats display config */
  statsDisplay?: Record<string, unknown>;
  /** Metadata */
  metadata?: {
    version?: string;
    author?: string;
    website?: string;
    repository?: string;
  };
}
