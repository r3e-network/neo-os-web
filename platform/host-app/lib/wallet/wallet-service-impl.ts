/**
 * Wallet Service Implementation
 *
 * Unified wallet service that abstracts social accounts and extension wallets.
 * MiniApps interact with this service without knowing the underlying provider.
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
import { NeoLineAdapter, O3Adapter, OneGateAdapter, Auth0Adapter } from "./adapters";

type ExtensionProvider = "neoline" | "o3" | "onegate";

/**
 * Wallet Service - Singleton Implementation
 */
class WalletServiceImpl implements IWalletService {
  private _account: UnifiedWalletAccount | null = null;
  private _providerType: WalletProviderType | null = null;
  private _extensionProvider: ExtensionProvider | null = null;
  private _listeners: Map<WalletEventType, Set<WalletEventListener>> = new Map();
  private _passwordCallback: PasswordRequestCallback | null = null;

  // Adapters
  private readonly extensionAdapters = {
    neoline: new NeoLineAdapter(),
    o3: new O3Adapter(),
    onegate: new OneGateAdapter(),
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

    if (this._providerType === "social") {
      return this.socialAdapter.getBalance(this._account.address);
    }

    if (this._extensionProvider) {
      return this.extensionAdapters[this._extensionProvider].getBalance(this._account.address);
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
      return this.extensionAdapters[this._extensionProvider].signMessage(request.message);
    }

    throw new Error("Invalid wallet state");
  }

  async invoke(request: InvokeRequest): Promise<TransactionResult> {
    if (!this._account) {
      throw new WalletNotConnectedError();
    }

    const params = {
      scriptHash: request.scriptHash,
      operation: request.operation,
      args: request.args,
      signers: request.signers,
    };

    if (this._providerType === "social") {
      const password = request.password || (await this.requestPassword());
      return this.socialAdapter.invokeWithPassword(params, password);
    }

    if (this._extensionProvider) {
      return this.extensionAdapters[this._extensionProvider].invoke(params);
    }

    throw new Error("Invalid wallet state");
  }

  async connect(providerType: WalletProviderType, providerName?: string): Promise<UnifiedWalletAccount> {
    if (providerType === "social") {
      return this.connectSocial();
    }

    return this.connectExtension(providerName as ExtensionProvider);
  }

  private async connectSocial(): Promise<UnifiedWalletAccount> {
    const walletAccount = await this.socialAdapter.connect();

    this._account = {
      address: walletAccount.address,
      publicKey: walletAccount.publicKey,
      providerType: "social",
      providerName: "Social Account",
      label: walletAccount.label,
    };
    this._providerType = "social";
    this._extensionProvider = null;

    this.emit({ type: "connected", data: this._account });
    return this._account;
  }

  private async connectExtension(provider: ExtensionProvider = "neoline"): Promise<UnifiedWalletAccount> {
    const adapter = this.extensionAdapters[provider];
    if (!adapter.isInstalled()) {
      throw new Error(`${adapter.name} wallet is not installed`);
    }

    const walletAccount = await adapter.connect();

    this._account = {
      address: walletAccount.address,
      publicKey: walletAccount.publicKey,
      providerType: "extension",
      providerName: adapter.name,
      label: walletAccount.label,
    };
    this._providerType = "extension";
    this._extensionProvider = provider;

    this.emit({ type: "connected", data: this._account });
    return this._account;
  }

  async disconnect(): Promise<void> {
    if (this._providerType === "extension" && this._extensionProvider) {
      await this.extensionAdapters[this._extensionProvider].disconnect();
    }

    this._account = null;
    this._providerType = null;
    this._extensionProvider = null;

    this.emit({ type: "disconnected" });
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
