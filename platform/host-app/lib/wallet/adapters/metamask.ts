/**
 * MetaMask Wallet Adapter
 *
 * EVM wallet adapter for MetaMask browser extension.
 */

import type { IWalletAdapter, WalletAdapterEvents } from "./interface";
import type {
  ChainId,
  ChainAccount,
  TransactionRequest,
  TransactionResult,
  EVMTransactionRequest,
} from "../../chains/types";
import { getChainRegistry } from "../../chains/registry";
import { isEVMChain, isEVMTransactionRequest } from "../../chains/types";

type EventCallback = WalletAdapterEvents[keyof WalletAdapterEvents];

export class MetaMaskAdapter implements IWalletAdapter {
  readonly id = "metamask";
  readonly name = "MetaMask";
  readonly chainType = "evm" as const;

  private account: ChainAccount | null = null;
  private listeners: Map<string, Set<EventCallback>> = new Map();

  isAvailable(): boolean {
    return typeof window !== "undefined" && !!window.ethereum?.isMetaMask;
  }

  isConnected(): boolean {
    return this.account !== null;
  }

  getAccount(): ChainAccount | null {
    return this.account;
  }

  async connect(chainId: ChainId): Promise<ChainAccount> {
    if (!this.isAvailable()) {
      throw new Error("MetaMask is not installed");
    }

    const registry = getChainRegistry();
    const chain = registry.getChain(chainId);
    if (!chain || !isEVMChain(chain)) {
      throw new Error(`Chain ${chainId} is not supported by MetaMask`);
    }

    try {
      // Request account access
      const accounts = (await window.ethereum!.request({
        method: "eth_requestAccounts",
      })) as string[];

      if (!accounts || accounts.length === 0) {
        throw new Error("No accounts found");
      }

      // Switch to the requested chain
      await this.switchChain(chainId);

      // Get balance
      const balance = await window.ethereum!.request({
        method: "eth_getBalance",
        params: [accounts[0], "latest"],
      });

      this.account = {
        chainId,
        address: accounts[0],
        balance: {
          native: BigInt(balance as string).toString(),
        },
      };

      this.emit("connect", this.account);
      return this.account;
    } catch (error: any) {
      this.emit("error", error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    this.account = null;
    this.emit("disconnect");
  }

  async switchChain(chainId: ChainId): Promise<void> {
    const registry = getChainRegistry();
    const chain = registry.getChain(chainId);
    if (!chain || !isEVMChain(chain)) {
      throw new Error(`Chain ${chainId} is not an EVM chain`);
    }

    const hexChainId = `0x${chain.chainId.toString(16)}`;

    try {
      await window.ethereum!.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: hexChainId }],
      });
    } catch (error: any) {
      // Chain not added, try to add it
      if (error.code === 4902) {
        await window.ethereum!.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: hexChainId,
              chainName: chain.name,
              nativeCurrency: chain.nativeCurrency,
              rpcUrls: chain.rpcUrls,
              blockExplorerUrls: [chain.explorerUrl],
            },
          ],
        });
      } else {
        throw error;
      }
    }

    if (this.account) {
      this.account.chainId = chainId;
      this.emit("chainChanged", chainId);
    }
  }

  async signMessage(message: string): Promise<string> {
    if (!this.account) {
      throw new Error("Not connected");
    }

    const signature = await window.ethereum!.request({
      method: "personal_sign",
      params: [message, this.account.address],
    });

    return signature as string;
  }

  async sendTransaction(request: TransactionRequest): Promise<TransactionResult> {
    if (!this.account) {
      throw new Error("Not connected");
    }

    if (!isEVMTransactionRequest(request)) {
      throw new Error("Invalid EVM transaction request");
    }

    const evmRequest = request as EVMTransactionRequest;

    const txHash = await window.ethereum!.request({
      method: "eth_sendTransaction",
      params: [
        {
          from: this.account.address,
          to: evmRequest.to,
          value: evmRequest.value ? `0x${BigInt(evmRequest.value).toString(16)}` : undefined,
          data: evmRequest.data,
          gas: evmRequest.gasLimit,
        },
      ],
    });

    return {
      chainId: this.account.chainId,
      txHash: txHash as string,
      status: "pending",
    };
  }

  // Event handling
  on<K extends keyof WalletAdapterEvents>(event: K, callback: WalletAdapterEvents[K]): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback as EventCallback);
  }

  off<K extends keyof WalletAdapterEvents>(event: K, callback: WalletAdapterEvents[K]): void {
    this.listeners.get(event)?.delete(callback as EventCallback);
  }

  private emit<K extends keyof WalletAdapterEvents>(event: K, ...args: Parameters<WalletAdapterEvents[K]>): void {
    this.listeners.get(event)?.forEach((cb) => {
      (cb as (...args: unknown[]) => void)(...args);
    });
  }
}

// Ethereum provider type declaration
declare global {
  interface Window {
    ethereum?: {
      isMetaMask?: boolean;
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      on?: (event: string, callback: (...args: unknown[]) => void) => void;
      removeListener?: (event: string, callback: (...args: unknown[]) => void) => void;
    };
  }
}
