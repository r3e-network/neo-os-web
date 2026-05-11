/**
 * OneGate Wallet Adapter for Neo N3
 * https://onegate.space/
 */

import {
  WalletAdapter,
  WalletAccount,
  WalletBalance,
  TransactionResult,
  SignedMessage,
  InvokeParams,
  WalletNotInstalledError,
  WalletConnectionError,
} from "./base";
import { normalizeNeoNetwork, type NeoNetwork } from "@/lib/neo-network";
import { Nep21Adapter } from "./nep21";

/** Window with OneGate wallet */
interface OneGateWindow {
  OneGate?: OneGateInstance;
}

interface OneGateInstance {
  getAccount(): Promise<{ address: string; publicKey: string }>;
  getNetwork?(): Promise<unknown>;
  network?: unknown;
  getBalance(params: { address: string }): Promise<{
    neo: string;
    gas: string;
  }>;
  signMessage(params: { message: string }): Promise<SignedMessage>;
  invoke(params: InvokeParams): Promise<{ txid: string }>;
}

export class OneGateAdapter implements WalletAdapter {
  readonly name = "OneGate";
  readonly icon = "https://onegate.space/favicon.ico";
  readonly downloadUrl = "https://onegate.space/";

  private readonly nep21 = new Nep21Adapter("onegate");

  private getWindow(): OneGateWindow {
    return window as unknown as OneGateWindow;
  }

  isInstalled(): boolean {
    if (typeof window === "undefined") return false;
    return this.nep21.isInstalled() || !!this.getWindow().OneGate;
  }

  async connect(): Promise<WalletAccount> {
    if (this.nep21.isInstalled()) {
      return this.nep21.connect();
    }
    if (!this.isInstalled()) {
      throw new WalletNotInstalledError(this.name);
    }

    try {
      const account = await this.getWindow().OneGate!.getAccount();
      return {
        address: account.address,
        publicKey: account.publicKey,
        network: await this.getNetwork(),
      };
    } catch (error) {
      throw new WalletConnectionError(`Failed to connect to OneGate: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async disconnect(): Promise<void> {
    await this.nep21.disconnect();
    // OneGate doesn't have explicit disconnect
  }

  async getNetwork(): Promise<NeoNetwork | null> {
    if (this.nep21.isInstalled()) return this.nep21.getNetwork();
    if (!this.isInstalled()) return null;
    const api = this.getWindow().OneGate;
    const source = typeof api?.getNetwork === "function"
      ? await api.getNetwork()
      : api?.network;
    if (source && typeof source === "object") {
      const record = source as Record<string, unknown>;
      return normalizeNeoNetwork(record.network ?? record.chainId ?? record.id);
    }
    return normalizeNeoNetwork(source);
  }

  async getBalance(address: string): Promise<WalletBalance> {
    if (this.nep21.isInstalled()) return this.nep21.getBalance(address);
    if (!this.isInstalled()) return { neo: "0", gas: "0" };

    try {
      return await this.getWindow().OneGate!.getBalance({ address });
    } catch (e: unknown) {
      console.warn("[OneGate] getBalance failed:", e instanceof Error ? e.message : String(e));
      return { neo: "0", gas: "0" };
    }
  }

  async signMessage(message: string): Promise<SignedMessage> {
    if (this.nep21.isInstalled()) return this.nep21.signMessage(message);
    if (!this.isInstalled()) {
      throw new WalletNotInstalledError(this.name);
    }
    const api = this.getWindow().OneGate;
    if (!api) throw new Error("OneGate API is not available");
    return api.signMessage({ message });
  }

  async invoke(params: InvokeParams): Promise<TransactionResult> {
    if (this.nep21.isInstalled()) return this.nep21.invoke(params);
    if (!this.isInstalled()) {
      throw new WalletNotInstalledError(this.name);
    }
    const api = this.getWindow().OneGate;
    if (!api) throw new Error("OneGate API is not available");
    return api.invoke(params);
  }
}
