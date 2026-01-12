/**
 * Multi-Chain Bridge Handler
 *
 * Handles messages from miniapp SDK and routes to appropriate services.
 */

import type { BridgeMessage, BridgeResponse, MessageType } from "./types";
import { getChainRegistry } from "../chains/registry";
import { useMultiChainWallet } from "../wallet/multi-chain-store";

type Handler = (payload: unknown) => Promise<unknown>;

const handlers: Record<MessageType, Handler> = {
  MULTICHAIN_GET_CHAINS: handleGetChains,
  MULTICHAIN_GET_ACTIVE_CHAIN: handleGetActiveChain,
  MULTICHAIN_SWITCH_CHAIN: handleSwitchChain,
  MULTICHAIN_CONNECT: handleConnect,
  MULTICHAIN_DISCONNECT: handleDisconnect,
  MULTICHAIN_GET_ACCOUNT: handleGetAccount,
  MULTICHAIN_SEND_TX: handleSendTx,
  MULTICHAIN_WAIT_TX: handleWaitTx,
  MULTICHAIN_CALL_CONTRACT: handleCallContract,
  MULTICHAIN_READ_CONTRACT: handleReadContract,
  MULTICHAIN_SUBSCRIBE: handleSubscribe,
  MULTICHAIN_UNSUBSCRIBE: handleUnsubscribe,
  MULTICHAIN_GET_BALANCE: handleGetBalance,
  MULTICHAIN_EVENT: async () => null,
};

export async function handleBridgeMessage(message: BridgeMessage): Promise<BridgeResponse> {
  const handler = handlers[message.type];
  if (!handler) {
    return {
      id: message.id,
      success: false,
      error: { code: "UNKNOWN_TYPE", message: `Unknown message type: ${message.type}` },
    };
  }

  try {
    const data = await handler(message.payload);
    return { id: message.id, success: true, data };
  } catch (err) {
    return {
      id: message.id,
      success: false,
      error: {
        code: "HANDLER_ERROR",
        message: err instanceof Error ? err.message : "Unknown error",
      },
    };
  }
}

// ============================================================================
// Handler Implementations
// ============================================================================

async function handleGetChains(): Promise<unknown> {
  const registry = getChainRegistry();
  return registry.getChains().map((c) => ({
    id: c.id,
    name: c.name,
    type: c.type,
    icon: c.icon,
    isTestnet: c.isTestnet,
  }));
}

async function handleGetActiveChain(): Promise<unknown> {
  const store = useMultiChainWallet.getState();
  if (!store.activeChainId) return null;
  const registry = getChainRegistry();
  return registry.getChain(store.activeChainId);
}

async function handleSwitchChain(payload: unknown): Promise<void> {
  const { chainId } = payload as { chainId: string };
  const store = useMultiChainWallet.getState();
  await store.switchChain(chainId);
}

async function handleConnect(payload: unknown): Promise<unknown> {
  const { chainId, provider = "metamask" } = (payload as { chainId?: string; provider?: string }) || {};
  const store = useMultiChainWallet.getState();
  await store.connect(provider as "metamask" | "walletconnect", chainId || "neo-n3-mainnet");
  return store.account;
}

async function handleDisconnect(): Promise<void> {
  const store = useMultiChainWallet.getState();
  store.disconnect();
}

async function handleGetAccount(payload: unknown): Promise<unknown> {
  const { chainId } = (payload as { chainId?: string }) || {};
  const store = useMultiChainWallet.getState();
  const targetChain = chainId || store.activeChainId;
  if (!targetChain || !store.account) return null;
  return store.account.accounts?.[targetChain] || null;
}

async function handleSendTx(payload: unknown): Promise<unknown> {
  // TODO: Implement transaction sending via wallet adapter
  throw new Error("Not implemented");
}

async function handleWaitTx(payload: unknown): Promise<unknown> {
  // TODO: Implement transaction waiting
  throw new Error("Not implemented");
}

async function handleCallContract(payload: unknown): Promise<unknown> {
  // TODO: Implement contract call
  throw new Error("Not implemented");
}

async function handleReadContract(payload: unknown): Promise<unknown> {
  // TODO: Implement contract read
  throw new Error("Not implemented");
}

async function handleSubscribe(payload: unknown): Promise<void> {
  // TODO: Implement event subscription
}

async function handleUnsubscribe(payload: unknown): Promise<void> {
  // TODO: Implement event unsubscription
}

async function handleGetBalance(payload: unknown): Promise<string> {
  const { chainId, address } = payload as { chainId: string; address?: string };
  const registry = getChainRegistry();
  const chain = registry.getChain(chainId);
  if (!chain) throw new Error("Chain not found");

  // Get address from store if not provided
  const store = useMultiChainWallet.getState();
  const targetAddress = address || store.account?.accounts?.[chainId]?.address;
  if (!targetAddress) throw new Error("No address");

  // Fetch balance via RPC
  const rpcUrl = chain.rpcUrls?.[0];
  if (!rpcUrl) throw new Error("No RPC URL");
  if (chain.type === "evm") {
    const res = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "eth_getBalance",
        params: [targetAddress, "latest"],
        id: 1,
      }),
    });
    const data = await res.json();
    return data.result || "0x0";
  }

  // Neo N3
  const res = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "getnep17balances",
      params: [targetAddress],
      id: 1,
    }),
  });
  const data = await res.json();
  return JSON.stringify(data.result?.balance || []);
}
