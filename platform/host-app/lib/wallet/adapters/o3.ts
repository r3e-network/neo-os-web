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
import { normalizeNeoNetwork, type NeoNetwork } from "@/lib/neo-network";

/** Window with O3 wallet */
interface O3Window {
  neo3Dapi?: Neo3DapiInstance;
}

interface Neo3DapiInstance {
  getAccount(): Promise<{ address: string; label: string }>;
  getPublicKey(): Promise<{ address: string; publicKey: string }>;
  getNetwork?(): Promise<unknown>;
  network?: unknown;
  getBalance(params: { address: string; contracts: string[] }): Promise<{
    [contract: string]: { amount: string; symbol: string };
  }>;
  signMessage(params: { message: string }): Promise<SignedMessage>;
  invoke(params: InvokeParams): Promise<{ txid: string }>;
}

const NEO_CONTRACT = "0xef4073a0f2b305a38ec4050e4d3d28bc40ea63f5";
const GAS_CONTRACT = "0xd2a4cff31913016155e38e474a2c06d08be276cf";

export class O3Adapter implements WalletAdapter {
  readonly name = "O3";
  readonly icon = "https://o3.network/favicon.ico";
  readonly downloadUrl = "https://o3.network/";

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
        network: await this.getNetwork(),
      };
    } catch (error) {
      throw new WalletConnectionError(`Failed to connect to O3: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async disconnect(): Promise<void> {
    // O3 doesn't have explicit disconnect
  }

  async getNetwork(): Promise<NeoNetwork | null> {
    if (!this.isInstalled()) return null;
    const api = this.getWindow().neo3Dapi;
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
    if (!this.isInstalled()) return { neo: "0", gas: "0" };

    try {
      const result = await this.getWindow().neo3Dapi!.getBalance({
        address,
        contracts: [NEO_CONTRACT, GAS_CONTRACT],
      });

      return {
        neo: result[NEO_CONTRACT]?.amount || "0",
        gas: result[GAS_CONTRACT]?.amount || "0",
      };
    } catch (e: unknown) {
      console.warn("[o3] getBalance failed:", e instanceof Error ? e.message : String(e));
      return { neo: "0", gas: "0" };
    }
  }

  async signMessage(message: string): Promise<SignedMessage> {
    if (!this.isInstalled()) {
      throw new WalletNotInstalledError(this.name);
    }
    const api = this.getWindow().neo3Dapi;
    if (!api) throw new Error("O3 neo3Dapi is not available");
    return api.signMessage({ message });
  }

  async invoke(params: InvokeParams): Promise<TransactionResult> {
    if (!this.isInstalled()) {
      throw new WalletNotInstalledError(this.name);
    }
    const api = this.getWindow().neo3Dapi;
    if (!api) throw new Error("O3 neo3Dapi is not available");
    return api.invoke(params);
  }
}
