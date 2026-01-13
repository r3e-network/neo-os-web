/**
 * Chain Registry Service
 *
 * Manages chain configurations with database persistence.
 * Supports dynamic chain addition and configuration updates.
 */

import type { ChainConfig, ChainId, ChainType } from "./types";
import { SUPPORTED_CHAIN_CONFIGS } from "./defaults";

// ============================================================================
// Chain Registry Interface
// ============================================================================

export interface IChainRegistry {
  /** Get all registered chains */
  getChains(): ChainConfig[];

  /** Get chain by ID */
  getChain(chainId: ChainId): ChainConfig | undefined;

  /** Get chains by type */
  getChainsByType(type: ChainType): ChainConfig[];

  /** Get active chains only */
  getActiveChains(): ChainConfig[];

  /** Get mainnet chains */
  getMainnetChains(): ChainConfig[];

  /** Get testnet chains */
  getTestnetChains(): ChainConfig[];

  /** Register a new chain */
  registerChain(config: ChainConfig): Promise<void>;

  /** Update chain configuration */
  updateChain(chainId: ChainId, updates: Partial<ChainConfig>): Promise<void>;

  /** Refresh chains from database */
  refresh(): Promise<void>;
}

// ============================================================================
// Chain Registry Implementation
// ============================================================================

class ChainRegistry implements IChainRegistry {
  private chains: Map<ChainId, ChainConfig> = new Map();
  private initialized = false;

  constructor() {
    // Initialize with platform supported chains
    SUPPORTED_CHAIN_CONFIGS.forEach((chain) => {
      this.chains.set(chain.id, chain);
    });
  }

  getChains(): ChainConfig[] {
    return Array.from(this.chains.values());
  }

  getChain(chainId: ChainId): ChainConfig | undefined {
    return this.chains.get(chainId);
  }

  getChainsByType(type: ChainType): ChainConfig[] {
    return this.getChains().filter((chain) => chain.type === type);
  }

  getActiveChains(): ChainConfig[] {
    return this.getChains().filter((chain) => chain.status === "active");
  }

  getMainnetChains(): ChainConfig[] {
    return this.getChains().filter((chain) => !chain.isTestnet);
  }

  getTestnetChains(): ChainConfig[] {
    return this.getChains().filter((chain) => chain.isTestnet);
  }

  async registerChain(config: ChainConfig): Promise<void> {
    this.chains.set(config.id, config);
    // TODO: Persist to database
  }

  async updateChain(chainId: ChainId, updates: Partial<ChainConfig>): Promise<void> {
    const existing = this.chains.get(chainId);
    if (!existing) {
      throw new Error(`Chain ${chainId} not found`);
    }
    const updated = { ...existing, ...updates, updatedAt: new Date().toISOString() };
    this.chains.set(chainId, updated as ChainConfig);
    // TODO: Persist to database
  }

  async refresh(): Promise<void> {
    // TODO: Load from database and merge with defaults
    this.initialized = true;
  }
}

// Singleton instance
export const chainRegistry = new ChainRegistry();

export function getChainRegistry(): IChainRegistry {
  return chainRegistry;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get native contract address for a chain
 * @param chainId - Chain ID
 * @param contractName - Contract name (e.g., 'neo', 'gas', 'multicall3')
 * @returns Contract address or undefined
 */
export function getNativeContract(chainId: ChainId, contractName: string): string | undefined {
  const chain = chainRegistry.getChain(chainId);
  if (!chain) return undefined;
  return (chain.contracts as Record<string, string>)?.[contractName];
}

/**
 * Get NEO token contract address
 */
export function getNeoContract(chainId: ChainId): string | undefined {
  return getNativeContract(chainId, "neo");
}

/**
 * Get GAS token contract address
 */
export function getGasContract(chainId: ChainId): string | undefined {
  return getNativeContract(chainId, "gas");
}
