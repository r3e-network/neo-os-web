/**
 * MetaMask Wallet Adapter
 *
 * EVM wallet adapter for MetaMask browser extension.
 */

import type { EVMWalletAdapter, WalletBalance, TransactionResult, EVMTransactionParams, WalletAccount } from "./base";
import type { ChainId } from "../../chains/types";
import { getChainRegistry } from "../../chains/registry";
import { isEVMChain } from "../../chains/types";

export class MetaMaskAdapter implements EVMWalletAdapter {
  readonly id = "metamask";
  readonly name = "MetaMask";
  readonly icon = "https://metamask.io/favicon.ico";
  readonly downloadUrl = "https://metamask.io/";
  readonly chainType = "evm" as const;
  readonly supportedChainTypes = ["evm"] as const;

  private account: (WalletAccount & { balance?: { native: string } }) | null = null;
  private listeners: Map<string, Set<any>> = new Map();

  // Implementation of IWalletAdapter compatibility if needed, but primarily EVMWalletAdapter

  isAvailable(): boolean {
    return typeof window !== "undefined" && !!window.ethereum?.isMetaMask;
  }

  isInstalled(): boolean {
    // Alias for compatibility
    return this.isAvailable();
  }

  isConnected(): boolean {
    return this.account !== null;
  }

  async connect(chainId: ChainId): Promise<WalletAccount & { balance?: { native: string } }> {
    if (!this.isAvailable()) {
      throw new Error("MetaMask is not installed");
    }

    const registry = getChainRegistry();
    const chain = registry.getChain(chainId);
    if (!chain || !isEVMChain(chain)) {
      throw new Error(`Chain ${chainId} is not supported by MetaMask`);
    }

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
    const balanceVal = await window.ethereum!.request({
      method: "eth_getBalance",
      params: [accounts[0], "latest"],
    });

    this.account = {
      chainId,
      address: accounts[0],
      publicKey: "", // MetaMask doesn't expose public key easily without signing
      balance: {
        native: BigInt(balanceVal as string).toString(),
      },
    };

    return this.account;
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

  async getBalance(address: string, chainId: ChainId): Promise<WalletBalance> {
    // Ensure we query the correct chain's RPC or switch?
    // For MetaMask, eth_getBalance queries the *current* connected chain of the provider usually,
    // or we should use an RPC URL from registry to be safe if checking non-active chain.
    // But adapter usually uses the injected provider.

    // Note: If chainId != current MetaMask chain, this might return wrong value if we just use window.ethereum.
    // But switchChain should have been called.
    // For safety, we can trust the provider is on the right chain if we just switched.

    const registry = getChainRegistry();
    const chain = registry.getChain(chainId);
    const symbol = chain?.nativeCurrency?.symbol || "ETH";

    const balanceHex = await window.ethereum!.request({
      method: "eth_getBalance",
      params: [address, "latest"],
    });

    return {
      native: BigInt(balanceHex as string).toString(),
      nativeSymbol: symbol,
      governance: undefined,
      governanceSymbol: undefined,
    };
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

  async sendTransaction(params: EVMTransactionParams): Promise<TransactionResult> {
    if (!this.account) {
      throw new Error("Not connected");
    }

    // Convert generic params to MetaMask format
    const txHash = await window.ethereum!.request({
      method: "eth_sendTransaction",
      params: [
        {
          from: this.account.address,
          to: params.to,
          value: params.value ? `0x${BigInt(params.value).toString(16)}` : undefined,
          data: params.data,
          gas: params.gasLimit,
          gasPrice: params.gasPrice,
          maxFeePerGas: params.maxFeePerGas,
          maxPriorityFeePerGas: params.maxPriorityFeePerGas,
        },
      ],
    });

    return {
      txid: txHash as string, // Map txHash to txid
      chainType: "evm",
    };
  }

  // Event handling (simplified)
  on(event: string, callback: any): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  off(event: string, callback: any): void {
    this.listeners.get(event)?.delete(callback);
  }

  getAccount(): (WalletAccount & { balance?: { native: string } }) | null {
    return this.account;
  }

  private emit(event: string, ...args: any[]): void {
    this.listeners.get(event)?.forEach((cb) => cb(...args));
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
