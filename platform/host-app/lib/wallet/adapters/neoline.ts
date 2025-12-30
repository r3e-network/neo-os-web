/**
 * NeoLine Wallet Adapter for Neo N3
 * https://neoline.io/
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

/** NeoLine wallet provider interface */
interface NeoLineProvider {
  Init: () => Promise<NeoLineInstance>;
}

/** Window with NeoLine wallet */
interface NeoLineWindow {
  NEOLineN3?: NeoLineProvider;
  NEOLine?: NeoLineProvider;
}

/** NeoLine wallet instance interface */
interface NeoLineInstance {
  getAccount(): Promise<{ address: string; label: string }>;
  getPublicKey(): Promise<{ address: string; publicKey: string }>;
  getBalance(params: { address: string }): Promise<
    Array<{
      contract: string;
      symbol: string;
      amount: string;
    }>
  >;
  signMessage(params: { message: string }): Promise<{
    publicKey: string;
    data: string;
    salt: string;
    message: string;
  }>;
  invoke(params: {
    scriptHash: string;
    operation: string;
    args: Array<{ type: string; value: unknown }>;
    signers?: Array<{ account: string; scopes: number }>;
  }): Promise<{ txid: string; nodeUrl: string }>;
}

const NEO_CONTRACT = "0xef4073a0f2b305a38ec4050e4d3d28bc40ea63f5";
const GAS_CONTRACT = "0xd2a4cff31913016155e38e474a2c06d08be276cf";

export class NeoLineAdapter implements WalletAdapter {
  readonly name = "NeoLine";
  readonly icon = "https://neoline.io/favicon.ico";
  readonly downloadUrl = "https://neoline.io/";

  private instance: NeoLineInstance | null = null;

  isInstalled(): boolean {
    if (typeof window === "undefined") return false;
    const win = window as unknown as NeoLineWindow;
    return !!win.NEOLineN3 || !!win.NEOLine;
  }

  private async getInstance(): Promise<NeoLineInstance> {
    if (this.instance) return this.instance;

    if (!this.isInstalled()) {
      throw new WalletNotInstalledError(this.name);
    }

    try {
      const win = window as unknown as NeoLineWindow;
      const provider = win.NEOLineN3 || win.NEOLine;

      // NeoLine requires calling Init as a constructor-like pattern
      // Wait for the NEOLine.Init event if not ready
      if (!provider) {
        throw new WalletConnectionError("NeoLine provider not found");
      }

      // NeoLine.Init is a class constructor, must be called with 'new'
      // It returns the instance directly (not a Promise)
      this.instance = new (provider.Init as unknown as new () => NeoLineInstance)();

      return this.instance;
    } catch (error) {
      throw new WalletConnectionError(`Failed to initialize NeoLine: ${error}`);
    }
  }

  async connect(): Promise<WalletAccount> {
    const instance = await this.getInstance();

    try {
      const account = await instance.getAccount();
      const pubKey = await instance.getPublicKey();

      return {
        address: account.address,
        publicKey: pubKey.publicKey,
        label: account.label,
      };
    } catch (error) {
      throw new WalletConnectionError(`Failed to connect to NeoLine: ${error}`);
    }
  }

  async disconnect(): Promise<void> {
    this.instance = null;
  }

  async getBalance(address: string): Promise<WalletBalance> {
    const instance = await this.getInstance();

    try {
      const balances = await instance.getBalance({ address });

      let neo = "0";
      let gas = "0";

      // Normalize contract addresses for comparison (case-insensitive, handle 0x prefix)
      const normalizeContract = (c: string) => c.toLowerCase().replace(/^0x/, "");
      const neoNorm = normalizeContract(NEO_CONTRACT);
      const gasNorm = normalizeContract(GAS_CONTRACT);

      for (const b of balances) {
        const contractNorm = normalizeContract(b.contract);
        if (contractNorm === neoNorm) neo = b.amount;
        if (contractNorm === gasNorm) gas = b.amount;
        // Also check by symbol as fallback
        if (b.symbol?.toUpperCase() === "NEO") neo = b.amount;
        if (b.symbol?.toUpperCase() === "GAS") gas = b.amount;
      }

      return { neo, gas };
    } catch (error) {
      console.error("Failed to get balance:", error);
      return { neo: "0", gas: "0" };
    }
  }

  async signMessage(message: string): Promise<SignedMessage> {
    const instance = await this.getInstance();
    return instance.signMessage({ message });
  }

  async invoke(params: InvokeParams): Promise<TransactionResult> {
    const instance = await this.getInstance();
    return instance.invoke(params);
  }
}
