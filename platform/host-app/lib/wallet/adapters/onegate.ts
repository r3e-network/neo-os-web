/**
 * OneGate Wallet Adapter for Neo N3.
 *
 * OneGate is integrated through the standard NEP-21 dAPI provider surface.
 * The old window.OneGate shape is intentionally not used for login or
 * contract execution so platform wallet behavior stays identical across
 * OneGate, NeoLine, and compatible NEP-21 providers.
 */

import {
  WalletAdapter,
  WalletAccount,
  WalletBalance,
  TransactionResult,
  SignedMessage,
  InvokeParams,
  WalletNotInstalledError,
} from "./base";
import { type NeoNetwork } from "@/lib/neo-network";
import { Nep21Adapter } from "./nep21";

export class OneGateAdapter implements WalletAdapter {
  readonly name = "OneGate";
  readonly icon = "https://onegate.space/favicon.ico";
  readonly downloadUrl = "https://onegate.space/";

  private readonly nep21 = new Nep21Adapter("onegate");

  isInstalled(): boolean {
    if (typeof window === "undefined") return false;
    return this.nep21.isInstalled();
  }

  async connect(): Promise<WalletAccount> {
    if (!this.isInstalled()) {
      throw new WalletNotInstalledError("OneGate NEP-21 dAPI");
    }
    return this.nep21.connect();
  }

  async connectSilently(): Promise<WalletAccount | null> {
    if (!this.isInstalled()) return null;
    return this.nep21.connectSilently();
  }

  async disconnect(): Promise<void> {
    await this.nep21.disconnect();
  }

  async getNetwork(): Promise<NeoNetwork | null> {
    if (!this.isInstalled()) return null;
    return this.nep21.getNetwork();
  }

  async getBalance(address: string): Promise<WalletBalance> {
    if (!this.isInstalled()) {
      throw new WalletNotInstalledError("OneGate NEP-21 dAPI");
    }
    return this.nep21.getBalance(address);
  }

  async signMessage(message: string): Promise<SignedMessage> {
    if (!this.isInstalled()) {
      throw new WalletNotInstalledError("OneGate NEP-21 dAPI");
    }
    return this.nep21.signMessage(message);
  }

  async invoke(params: InvokeParams): Promise<TransactionResult> {
    if (!this.isInstalled()) {
      throw new WalletNotInstalledError("OneGate NEP-21 dAPI");
    }
    return this.nep21.invoke(params);
  }

  async invokeMultiple(
    params: InvokeParams[],
    signers?: InvokeParams["signers"],
  ): Promise<TransactionResult> {
    if (!this.isInstalled()) {
      throw new WalletNotInstalledError("OneGate NEP-21 dAPI");
    }
    return this.nep21.invokeMultiple(params, signers);
  }
}
