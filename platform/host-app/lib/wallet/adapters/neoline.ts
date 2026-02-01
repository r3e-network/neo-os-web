/**
 * NeoLine Wallet Adapter for Neo N3
 * https://neoline.io/
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
import { logger } from "../../logger";
import { getNeoContract, getGasContract } from "../../chains/registry";
import type { ChainId } from "../../chains/types";

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

export class NeoLineAdapter implements WalletAdapter {
  readonly name = "NeoLine";
  readonly icon = "https://neoline.io/favicon.ico";
  readonly downloadUrl = "https://neoline.io/";
  readonly supportedChainTypes = ["neo-n3"] as const;

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

      if (!provider) {
        throw new WalletConnectionError("NeoLine provider not found");
      }

      // NeoLine.Init can be called as constructor or as async function
      // Try both patterns for compatibility
      try {
        // Pattern 1: Constructor style (older NeoLine versions)
        this.instance = new (provider.Init as unknown as new () => NeoLineInstance)();
        logger.debug("[NeoLine] Initialized via constructor pattern");
      } catch {
        // Pattern 2: Async function style (newer NeoLine versions)
        this.instance = await provider.Init();
        logger.debug("[NeoLine] Initialized via async pattern");
      }

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

  async getBalance(address: string, chainId: ChainId): Promise<WalletBalance> {
    const instance = await this.getInstance();

    try {
      logger.debug("[NeoLine] Fetching balance for address:", address);
      const balances = await instance.getBalance({ address });
      logger.debug("[NeoLine] Raw balance response:", JSON.stringify(balances, null, 2));

      let neo = "0";
      let gas = "0";

      // Get contract addresses from chain registry
      const neoContract = getNeoContract(chainId) || "";
      const gasContract = getGasContract(chainId) || "";

      // Normalize contract addresses for comparison (case-insensitive, handle 0x prefix)
      const normalizeContract = (c: string) => c.toLowerCase().replace(/^0x/, "");
      const neoNorm = normalizeContract(neoContract);
      const gasNorm = normalizeContract(gasContract);

      // Handle multiple possible response formats from NeoLine
      // NeoLine N3 returns: { [address]: [{ contract, symbol, amount }] }
      // or directly: [{ contract, symbol, amount }]
      let balanceArray: Array<{ contract: string; symbol: string; amount: string }> = [];

      type BalanceResponse = Record<string, unknown>;
      if (Array.isArray(balances)) {
        balanceArray = balances;
      } else if (balances && typeof balances === "object") {
        const bal = balances as BalanceResponse;
        // NeoLine N3 format: { [address]: [...] }
        const addressKey = Object.keys(bal).find((k) => k.startsWith("N"));
        if (addressKey && Array.isArray(bal[addressKey])) {
          balanceArray = bal[addressKey] as Array<{ contract: string; symbol: string; amount: string }>;
        }
        // Try different nested structures
        else if (Array.isArray(bal.balance)) {
          balanceArray = bal.balance as Array<{ contract: string; symbol: string; amount: string }>;
        } else if (Array.isArray(bal.balances)) {
          balanceArray = bal.balances as Array<{ contract: string; symbol: string; amount: string }>;
        } else if (Array.isArray(bal.result)) {
          balanceArray = bal.result as Array<{ contract: string; symbol: string; amount: string }>;
        }
      }

      if (!Array.isArray(balanceArray) || balanceArray.length === 0) {
        logger.warn(
          "[NeoLine] No balances returned or empty array, response structure:",
          typeof balances,
          JSON.stringify(balances),
        );
        // Return zero balances but don't throw error
        return { native: "0", nativeSymbol: "GAS", governance: "0", governanceSymbol: "NEO" };
      }

      for (const b of balanceArray) {
        if (!b || typeof b !== "object") continue;

        // Handle both 'contract' and 'asset_hash' field names
        const balItem = b as Record<string, unknown>;
        const contractField = b.contract || (typeof balItem.asset_hash === "string" ? balItem.asset_hash : undefined) || (typeof balItem.assetHash === "string" ? balItem.assetHash : "") || "";
        const contractNorm = normalizeContract(contractField);
        const symbol = (b.symbol || "").toUpperCase();
        const amount = b.amount || (typeof balItem.balance === "string" ? balItem.balance : undefined) || "0";

        logger.debug("[NeoLine] Processing balance:", symbol, amount, "contract:", contractField);

        // Match by contract address (most reliable)
        if (contractNorm === neoNorm) {
          neo = amount;
        }
        if (contractNorm === gasNorm) {
          gas = amount;
        }

        // Fallback: match by symbol
        if (symbol === "NEO" && neo === "0") {
          neo = amount;
        }
        if (symbol === "GAS" && gas === "0") {
          gas = amount;
        }
      }

      logger.debug("[NeoLine] Final balance - NEO:", neo, "GAS:", gas);

      // Return multi-chain format balance
      return {
        native: gas || "0",
        nativeSymbol: "GAS",
        governance: neo || "0",
        governanceSymbol: "NEO",
      };
    } catch (error) {
      logger.error("[NeoLine] Failed to get balance:", error);
      // Return zero balances on error
      return { native: "0", nativeSymbol: "GAS", governance: "0", governanceSymbol: "NEO" };
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
