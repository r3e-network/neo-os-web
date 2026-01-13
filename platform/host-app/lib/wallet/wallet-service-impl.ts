/**
 * Wallet Service Implementation
 *
 * Unified wallet service that abstracts social accounts and extension wallets.
 * MiniApps interact with this service without knowing the underlying provider.
 * Supports multi-chain: Neo N3, NeoX, Ethereum, and other EVM chains.
 */

import {
  IWalletService,
  UnifiedWalletAccount,
  WalletProviderType,
  SignRequest,
  InvokeRequest,
  WalletEventType,
  WalletEventListener,
  WalletEvent,
  PasswordRequestCallback,
  WalletNotConnectedError,
  WalletPasswordRequiredError,
  WalletUserCancelledError,
} from "./wallet-service";

import type { WalletBalance, SignedMessage, TransactionResult } from "./adapters/base";
import { NeoLineAdapter, O3Adapter, OneGateAdapter, Auth0Adapter, MetaMaskAdapter } from "./adapters";
import type { ChainId } from "../chains/types";
import { getChainRegistry } from "../chains/registry";

type NeoExtensionProvider = "neoline" | "o3" | "onegate";
type EVMExtensionProvider = "metamask";
type ExtensionProvider = NeoExtensionProvider | EVMExtensionProvider;

/**
 * Wallet Service - Singleton Implementation
 */
class WalletServiceImpl implements IWalletService {
  private _account: UnifiedWalletAccount | null = null;
  private _providerType: WalletProviderType | null = null;
  private _extensionProvider: ExtensionProvider | null = null;
  private _chainId: ChainId | null = null;
  private _listeners: Map<WalletEventType, Set<WalletEventListener>> = new Map();
  private _passwordCallback: PasswordRequestCallback | null = null;

  // Neo N3 Adapters
  private readonly neoAdapters = {
    neoline: new NeoLineAdapter(),
    o3: new O3Adapter(),
    onegate: new OneGateAdapter(),
  };

  // EVM Adapters
  private readonly evmAdapters = {
    metamask: new MetaMaskAdapter(),
  };

  private readonly socialAdapter = new Auth0Adapter();

  get isConnected(): boolean {
    return this._account !== null;
  }

  get account(): UnifiedWalletAccount | null {
    return this._account;
  }

  get providerType(): WalletProviderType | null {
    return this._providerType;
  }

  get chainId(): ChainId | null {
    return this._chainId;
  }

  async getAddress(): Promise<string> {
    if (!this._account) {
      throw new WalletNotConnectedError();
    }
    return this._account.address;
  }

  async getBalance(): Promise<WalletBalance> {
    if (!this._account) {
      throw new WalletNotConnectedError();
    }

    if (!this._chainId) {
      throw new Error("Chain ID not set - connect to a specific chain first");
    }

    if (this._providerType === "social") {
      return this.socialAdapter.getBalance(this._account.address, this._chainId);
    }

    if (this._extensionProvider) {
      // Check if it's a Neo adapter or EVM adapter
      if (this._extensionProvider in this.neoAdapters) {
        return this.neoAdapters[this._extensionProvider as NeoExtensionProvider].getBalance(
          this._account.address,
          this._chainId,
        );
      }
      // EVM adapters don't have getBalance in the same interface
      // Return a placeholder for now - actual balance is in account.balance
      // Get native symbol from chain registry for multi-chain support
      const registry = getChainRegistry();
      const chain = registry.getChain(this._chainId);
      const nativeSymbol = chain?.nativeCurrency?.symbol || "ETH";
      return { native: "0", nativeSymbol, governance: undefined, governanceSymbol: undefined };
    }

    throw new Error("Invalid wallet state");
  }

  async signMessage(request: SignRequest): Promise<SignedMessage> {
    if (!this._account) {
      throw new WalletNotConnectedError();
    }

    if (this._providerType === "social") {
      const password = request.password || (await this.requestPassword());
      return this.socialAdapter.signWithPassword(request.message, password);
    }

    if (this._extensionProvider) {
      // Check if it's a Neo adapter or EVM adapter
      if (this._extensionProvider in this.neoAdapters) {
        return this.neoAdapters[this._extensionProvider as NeoExtensionProvider].signMessage(request.message);
      }
      if (this._extensionProvider in this.evmAdapters) {
        const signature = await this.evmAdapters[this._extensionProvider as EVMExtensionProvider].signMessage(
          request.message,
        );
        return {
          publicKey: this._account.publicKey || "",
          data: signature,
          salt: "",
          message: request.message,
        };
      }
    }

    throw new Error("Invalid wallet state");
  }

  async invoke(request: InvokeRequest): Promise<TransactionResult> {
    if (!this._account) {
      throw new WalletNotConnectedError();
    }

    if (!this._chainId) {
      throw new Error("Chain ID not set - connect to a specific chain first");
    }

    const params = {
      scriptHash: request.scriptHash,
      operation: request.operation,
      args: request.args,
      signers: request.signers,
    };

    if (this._providerType === "social") {
      const password = request.password || (await this.requestPassword());
      return this.socialAdapter.invokeWithPassword(params, password, this._chainId);
    }

    if (this._extensionProvider) {
      // Check if it's a Neo adapter
      if (this._extensionProvider in this.neoAdapters) {
        return this.neoAdapters[this._extensionProvider as NeoExtensionProvider].invoke(params);
      }
      // EVM adapters use sendTransaction instead of invoke
      throw new Error("Use sendTransaction for EVM chains");
    }

    throw new Error("Invalid wallet state");
  }

  async connect(
    providerType: WalletProviderType,
    providerName?: string,
    chainId?: ChainId,
  ): Promise<UnifiedWalletAccount> {
    if (providerType === "social") {
      return this.connectSocial(chainId);
    }

    return this.connectExtension(providerName as ExtensionProvider, chainId);
  }

  private async connectSocial(chainId: ChainId = "neo-n3-mainnet"): Promise<UnifiedWalletAccount> {
    const walletAccount = await this.socialAdapter.connect();
    const registry = getChainRegistry();
    const chain = registry.getChain(chainId);

    this._account = {
      address: walletAccount.address,
      publicKey: walletAccount.publicKey,
      providerType: "social",
      providerName: "Social Account",
      chainId,
      chainType: chain?.type || "neo-n3",
      label: walletAccount.label,
    };
    this._providerType = "social";
    this._extensionProvider = null;
    this._chainId = chainId;

    this.emit({ type: "connected", data: this._account });
    return this._account;
  }

  private async connectExtension(
    provider: ExtensionProvider = "neoline",
    chainId?: ChainId,
  ): Promise<UnifiedWalletAccount> {
    const registry = getChainRegistry();

    // Determine if it's a Neo or EVM provider
    if (provider in this.neoAdapters) {
      const adapter = this.neoAdapters[provider as NeoExtensionProvider];
      if (!adapter.isInstalled()) {
        throw new Error(`${adapter.name} wallet is not installed`);
      }

      const walletAccount = await adapter.connect();
      const effectiveChainId = chainId || "neo-n3-mainnet";
      const chain = registry.getChain(effectiveChainId);

      this._account = {
        address: walletAccount.address,
        publicKey: walletAccount.publicKey,
        providerType: "extension",
        providerName: adapter.name,
        chainId: effectiveChainId,
        chainType: chain?.type || "neo-n3",
        label: walletAccount.label,
      };
      this._providerType = "extension";
      this._extensionProvider = provider;
      this._chainId = effectiveChainId;

      this.emit({ type: "connected", data: this._account });
      return this._account;
    }

    if (provider in this.evmAdapters) {
      const adapter = this.evmAdapters[provider as EVMExtensionProvider];
      if (!adapter.isAvailable()) {
        throw new Error(`${adapter.name} wallet is not installed`);
      }

      const effectiveChainId = chainId || "neox-mainnet";
      const chainAccount = await adapter.connect(effectiveChainId);

      this._account = {
        address: chainAccount.address,
        publicKey: chainAccount.publicKey || "",
        providerType: "extension",
        providerName: adapter.name,
        chainId: effectiveChainId,
        chainType: "evm",
      };
      this._providerType = "extension";
      this._extensionProvider = provider;
      this._chainId = effectiveChainId;

      this.emit({ type: "connected", data: this._account });
      return this._account;
    }

    throw new Error(`Unknown provider: ${provider}`);
  }

  async disconnect(): Promise<void> {
    if (this._providerType === "extension" && this._extensionProvider) {
      if (this._extensionProvider in this.neoAdapters) {
        await this.neoAdapters[this._extensionProvider as NeoExtensionProvider].disconnect();
      } else if (this._extensionProvider in this.evmAdapters) {
        await this.evmAdapters[this._extensionProvider as EVMExtensionProvider].disconnect();
      }
    }

    this._account = null;
    this._providerType = null;
    this._extensionProvider = null;
    this._chainId = null;

    this.emit({ type: "disconnected" });
  }

  async switchChain(chainId: ChainId): Promise<void> {
    if (!this._account) {
      throw new WalletNotConnectedError();
    }

    const registry = getChainRegistry();
    const chain = registry.getChain(chainId);
    if (!chain) {
      throw new Error(`Unknown chain: ${chainId}`);
    }

    // Only EVM adapters support chain switching
    if (this._extensionProvider && this._extensionProvider in this.evmAdapters) {
      await this.evmAdapters[this._extensionProvider as EVMExtensionProvider].switchChain(chainId);
      this._chainId = chainId;
      if (this._account) {
        this._account.chainId = chainId;
        this._account.chainType = chain.type;
      }
      this.emit({ type: "accountChanged", data: this._account });
    } else {
      throw new Error("Chain switching is only supported for EVM wallets");
    }
  }

  on(event: WalletEventType, listener: WalletEventListener): void {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, new Set());
    }
    this._listeners.get(event)!.add(listener);
  }

  off(event: WalletEventType, listener: WalletEventListener): void {
    this._listeners.get(event)?.delete(listener);
  }

  setPasswordCallback(callback: PasswordRequestCallback): void {
    this._passwordCallback = callback;
  }

  private emit(event: WalletEvent): void {
    this._listeners.get(event.type)?.forEach((listener) => listener(event));
  }

  private async requestPassword(): Promise<string> {
    this.emit({ type: "passwordRequired" });

    if (!this._passwordCallback) {
      throw new WalletPasswordRequiredError();
    }

    try {
      return await this._passwordCallback();
    } catch {
      throw new WalletUserCancelledError();
    }
  }
}

// Singleton instance
let walletServiceInstance: WalletServiceImpl | null = null;

/**
 * Get the wallet service singleton
 */
export function getWalletService(): IWalletService {
  if (!walletServiceInstance) {
    walletServiceInstance = new WalletServiceImpl();
  }
  return walletServiceInstance;
}

/**
 * Reset wallet service (for testing)
 */
export function resetWalletService(): void {
  walletServiceInstance = null;
}
