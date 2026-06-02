/**
 * NeoLine Wallet Adapter for Neo N3.
 *
 * NeoLine is integrated through the standard NEP-21 dAPI provider surface.
 * The legacy NEOLineN3 API is intentionally not treated as installed here:
 * wallet actions in the platform must use the same NEP-21 invocation,
 * signer, network, and account mapping path as OneGate and generic dAPI
 * providers.
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

export class NeoLineAdapter implements WalletAdapter {
  readonly name = "NeoLine";
  readonly icon = "https://neoline.io/favicon.ico";
  readonly downloadUrl = "https://neoline.io/";

  private readonly nep21 = new Nep21Adapter("neoline");

  isInstalled(): boolean {
    if (typeof window === "undefined") return false;
    return this.nep21.isInstalled();
  }

  async connect(): Promise<WalletAccount> {
    if (!this.nep21.isInstalled()) {
      throw new WalletNotInstalledError("NeoLine NEP-21 dAPI");
    }
    return this.nep21.connect();
  }

  async disconnect(): Promise<void> {
    await this.nep21.disconnect();
  }

  async getNetwork(): Promise<NeoNetwork | null> {
    if (!this.nep21.isInstalled()) return null;
    return this.nep21.getNetwork();
  }

  async getBalance(address: string): Promise<WalletBalance> {
    if (!this.nep21.isInstalled()) {
      throw new WalletNotInstalledError("NeoLine NEP-21 dAPI");
    }
    return this.nep21.getBalance(address);
  }

  async signMessage(message: string): Promise<SignedMessage> {
    if (!this.nep21.isInstalled()) {
      throw new WalletNotInstalledError("NeoLine NEP-21 dAPI");
    }
    return this.nep21.signMessage(message);
  }

  async invoke(params: InvokeParams): Promise<TransactionResult> {
    if (!this.nep21.isInstalled()) {
      throw new WalletNotInstalledError("NeoLine NEP-21 dAPI");
    }
    return this.nep21.invoke(params);
  }

  async invokeMultiple(
    params: InvokeParams[],
    signers?: InvokeParams["signers"],
  ): Promise<TransactionResult> {
    if (!this.nep21.isInstalled()) {
      throw new WalletNotInstalledError("NeoLine NEP-21 dAPI");
    }
    return this.nep21.invokeMultiple(params, signers);
  }
}
