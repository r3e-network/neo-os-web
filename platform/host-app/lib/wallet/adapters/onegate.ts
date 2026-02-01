import type { ChainId } from "../../chains/types";

/**
 * OneGate Wallet Adapter for Neo N3
 * https://onegate.space/
 */

import type {
  WalletAdapter,
  WalletAccount,
  WalletBalance,
  TransactionResult,
  SignedMessage,
  InvokeParams} from "./base";
import {
  WalletNotInstalledError,
  WalletConnectionError,
} from "./base";

/** Window with OneGate wallet */
interface OneGateWindow {
  OneGate?: OneGateInstance;
}

interface OneGateInstance {
  getAccount(): Promise<{ address: string; publicKey: string }>;
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
  readonly supportedChainTypes = ["neo-n3"] as const;

  private getWindow(): OneGateWindow {
    return window as unknown as OneGateWindow;
  }

  isInstalled(): boolean {
    if (typeof window === "undefined") return false;
    return !!this.getWindow().OneGate;
  }

  async connect(): Promise<WalletAccount> {
    if (!this.isInstalled()) {
      throw new WalletNotInstalledError(this.name);
    }

    try {
      const account = await this.getWindow().OneGate!.getAccount();
      return {
        address: account.address,
        publicKey: account.publicKey,
      };
    } catch (error) {
      throw new WalletConnectionError(`Failed to connect to OneGate: ${error}`);
    }
  }

  async disconnect(): Promise<void> {
    // OneGate doesn't have explicit disconnect
  }

  async getBalance(address: string, _chainId: ChainId): Promise<WalletBalance> {
    if (!this.isInstalled()) return { native: "0", nativeSymbol: "GAS", governance: "0", governanceSymbol: "NEO" };

    try {
      const result = await this.getWindow().OneGate!.getBalance({ address });
      return {
        native: result.gas || "0",
        nativeSymbol: "GAS",
        governance: result.neo || "0",
        governanceSymbol: "NEO",
      };
    } catch {
      return { native: "0", nativeSymbol: "GAS", governance: "0", governanceSymbol: "NEO" };
    }
  }

  async signMessage(message: string): Promise<SignedMessage> {
    if (!this.isInstalled()) {
      throw new WalletNotInstalledError(this.name);
    }
    return this.getWindow().OneGate!.signMessage({ message });
  }

  async invoke(params: InvokeParams): Promise<TransactionResult> {
    if (!this.isInstalled()) {
      throw new WalletNotInstalledError(this.name);
    }
    return this.getWindow().OneGate!.invoke(params);
  }
}
