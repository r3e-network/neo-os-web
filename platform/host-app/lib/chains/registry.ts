/**
 * Chain Registry Service
 *
 * Manages chain configurations with database persistence.
 * Supports dynamic chain addition and configuration updates.
 */

import type { ChainConfig, ChainId, ChainType } from "./types";
import { SUPPORTED_CHAIN_CONFIGS } from "./defaults";

const STORAGE_KEY = "neohub-chain-registry-v1";

type StoredChainRegistry = {
  version: 1;
  chains: ChainConfig[];
};

function loadStoredChains(): ChainConfig[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StoredChainRegistry;
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.chains)) {
      return [];
    }
    return parsed.chains;
  } catch {
    return [];
  }
}

function saveStoredChains(chains: ChainConfig[]): void {
  if (typeof window === "undefined") return;
  const payload: StoredChainRegistry = { version: 1, chains };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

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
    if (typeof window !== "undefined") {
      void this.refresh();
    }
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
    const now = new Date().toISOString();
    const normalized: ChainConfig = {
      ...config,
      createdAt: config.createdAt || now,
      updatedAt: config.updatedAt || now,
    };
    this.chains.set(config.id, normalized);
    saveStoredChains(this.getChains());
  }

  async updateChain(chainId: ChainId, updates: Partial<ChainConfig>): Promise<void> {
    const existing = this.chains.get(chainId);
    if (!existing) {
      throw new Error(`Chain ${chainId} not found`);
    }
    const updated = { ...existing, ...updates, updatedAt: new Date().toISOString() };
    this.chains.set(chainId, updated as ChainConfig);
    saveStoredChains(this.getChains());
  }

  async refresh(): Promise<void> {
    const merged = new Map<ChainId, ChainConfig>();
    SUPPORTED_CHAIN_CONFIGS.forEach((chain) => {
      merged.set(chain.id, chain);
    });

    const stored = loadStoredChains();
    stored.forEach((chain) => {
      const existing = merged.get(chain.id);
      merged.set(chain.id, existing ? ({ ...existing, ...chain } as ChainConfig) : chain);
    });

    this.chains = merged;
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
