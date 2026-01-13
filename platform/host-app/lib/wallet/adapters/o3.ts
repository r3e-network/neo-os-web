/**
 * O3 Wallet Adapter for Neo N3
 * https://o3.network/
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
import { getNeoContract, getGasContract } from "../../chains/registry";
import type { ChainId } from "../../chains/types";

/** Window with O3 wallet */
interface O3Window {
  neo3Dapi?: Neo3DapiInstance;
}

interface Neo3DapiInstance {
  getAccount(): Promise<{ address: string; label: string }>;
  getPublicKey(): Promise<{ address: string; publicKey: string }>;
  getBalance(params: { address: string; contracts: string[] }): Promise<{
    [contract: string]: { amount: string; symbol: string };
  }>;
  signMessage(params: { message: string }): Promise<SignedMessage>;
  invoke(params: InvokeParams): Promise<{ txid: string }>;
}

export class O3Adapter implements WalletAdapter {
  readonly name = "O3";
  readonly icon = "https://o3.network/favicon.ico";
  readonly downloadUrl = "https://o3.network/";
  readonly supportedChainTypes = ["neo-n3"] as const;

  private getWindow(): O3Window {
    return window as unknown as O3Window;
  }

  isInstalled(): boolean {
    if (typeof window === "undefined") return false;
    return !!this.getWindow().neo3Dapi;
  }

  async connect(): Promise<WalletAccount> {
    if (!this.isInstalled()) {
      throw new WalletNotInstalledError(this.name);
    }

    try {
      const dapi = this.getWindow().neo3Dapi!;
      const account = await dapi.getAccount();
      const pubKey = await dapi.getPublicKey();

      return {
        address: account.address,
        publicKey: pubKey.publicKey,
        label: account.label,
      };
    } catch (error) {
      throw new WalletConnectionError(`Failed to connect to O3: ${error}`);
    }
  }

  async disconnect(): Promise<void> {
    // O3 doesn't have explicit disconnect
  }

  async getBalance(address: string, chainId: ChainId): Promise<WalletBalance> {
    if (!this.isInstalled()) return { native: "0", nativeSymbol: "GAS", governance: "0", governanceSymbol: "NEO" };

    try {
      // Get contract addresses from chain registry
      const neoContract = getNeoContract(chainId) || "";
      const gasContract = getGasContract(chainId) || "";

      const result = await this.getWindow().neo3Dapi!.getBalance({
        address,
        contracts: [neoContract, gasContract],
      });

      return {
        native: result[gasContract]?.amount || "0",
        nativeSymbol: "GAS",
        governance: result[neoContract]?.amount || "0",
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
    return this.getWindow().neo3Dapi!.signMessage({ message });
  }

  async invoke(params: InvokeParams): Promise<TransactionResult> {
    if (!this.isInstalled()) {
      throw new WalletNotInstalledError(this.name);
    }
    return this.getWindow().neo3Dapi!.invoke(params);
  }
}
