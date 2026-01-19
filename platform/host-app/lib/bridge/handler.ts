/**
 * Multi-Chain Bridge Handler
 *
 * Handles messages from miniapp SDK and routes to appropriate services.
 */

import type { BridgeMessage, BridgeResponse, MessageType } from "./types";
import type { ChainId } from "../chains/types";
import { getChainRegistry } from "../chains/registry";
import { useMultiChainWallet, getMultiChainAdapter } from "../wallet/multi-chain-store";
import {
  evmCall,
  evmGetBlockNumber,
  getChainTypeFromId,
  getTransactionLogMultiChain,
  invokeRead,
  rpcCall,
} from "../chain/rpc-client";

type HandlerContext = {
  source?: MessageEventSource | null;
  origin?: string;
};

type Handler = (payload: unknown, context: HandlerContext) => Promise<unknown>;

type SdkTransactionRequest = {
  chainId: ChainId;
  to: string;
  value?: string;
  data?: string;
  gasLimit?: string;
  gasPrice?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
};

type ContractCallRequest = {
  chainId: ChainId;
  contractAddress: string;
  method: string;
  args?: unknown[];
  value?: string;
  data?: string;
};

type ContractReadRequest = {
  chainId: ChainId;
  contractAddress: string;
  method: string;
  args?: unknown[];
  data?: string;
};

type ContractReadResult = {
  chainId: ChainId;
  data: unknown;
};

type EventFilter = {
  chainId: ChainId;
  type: "block" | "transaction" | "contract" | "transfer";
  contractAddress?: string;
  fromBlock?: number | "latest";
  toBlock?: number | "latest";
};

type SubscriptionEntry = {
  filter: EventFilter;
  target: Window;
  origin: string;
  intervalId: number;
  lastBlock: number;
  isPolling: boolean;
};

const subscriptions = new Map<string, SubscriptionEntry>();
const SUBSCRIPTION_POLL_MS = 10_000;

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

export async function handleBridgeMessage(
  message: BridgeMessage,
  context: HandlerContext = {},
): Promise<BridgeResponse> {
  const handler = handlers[message.type];
  if (!handler) {
    return {
      id: message.id,
      success: false,
      error: { code: "UNKNOWN_TYPE", message: `Unknown message type: ${message.type}` },
    };
  }

  try {
    const data = await handler(message.payload, context);
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
  if (!chainId) {
    throw new Error("chainId is required for wallet connection");
  }
  const store = useMultiChainWallet.getState();
  await store.connect(provider as "metamask" | "walletconnect", chainId);
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

function resolveCallData(method: string, data?: string, args?: unknown[]): string {
  if (data && data.startsWith("0x")) return data;
  if (method.startsWith("0x")) return method;
  if (args && args.length > 0) {
    throw new Error("EVM contract args require ABI encoding. Provide hex-encoded data.");
  }
  throw new Error("EVM contract call requires hex-encoded data.");
}

async function sendEvmTransaction(chainId: ChainId, params: Omit<SdkTransactionRequest, "chainId" | "to"> & { to: string }) {
  const store = useMultiChainWallet.getState();
  if (!store.account) {
    throw new Error("Wallet not connected");
  }

  if (store.activeChainId !== chainId) {
    await store.switchChain(chainId);
  }

  const adapter = getMultiChainAdapter(store.account.provider);
  if (!adapter) {
    throw new Error("Wallet adapter not available");
  }

  if (adapter.chainType !== "evm" || typeof adapter.sendTransaction !== "function") {
    throw new Error("EVM wallet adapter required");
  }

  const result = await adapter.sendTransaction(
    {
      chainId,
      from: store.account.accounts[chainId]?.address || "",
      to: params.to,
      value: params.value,
      data: params.data,
      gasLimit: params.gasLimit,
      gasPrice: params.gasPrice,
      maxFeePerGas: params.maxFeePerGas,
      maxPriorityFeePerGas: params.maxPriorityFeePerGas,
    } as any, // Cast to any to bypass strict TransactionRequest checks for now
  );

  if (!result?.txHash) {
    throw new Error("Transaction hash missing from wallet response");
  }

  return result.txHash;
}

async function handleSendTx(payload: unknown): Promise<unknown> {
  const request = payload as SdkTransactionRequest;
  if (!request?.chainId || !request?.to) {
    throw new Error("chainId and to are required");
  }

  const chainType = getChainTypeFromId(request.chainId);
  if (chainType !== "evm") {
    throw new Error("sendTransaction is only supported for EVM chains");
  }

  const txHash = await sendEvmTransaction(request.chainId, request);
  return { chainId: request.chainId, txHash, status: "pending" };
}

async function handleWaitTx(payload: unknown): Promise<unknown> {
  const { chainId, txHash } = payload as { chainId?: ChainId; txHash?: string };
  if (!chainId || !txHash) {
    throw new Error("chainId and txHash are required");
  }

  const maxAttempts = 15;
  const delayMs = 2000;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const receipt = await getTransactionLogMultiChain(txHash, chainId);
    if (receipt) {
      const chainType = getChainTypeFromId(chainId);
      if (chainType === "evm") {
        const statusValue = (receipt as { status?: string | number | boolean })?.status;
        const blockHex = (receipt as { blockNumber?: string })?.blockNumber;
        const confirmed = statusValue === "0x1" || statusValue === 1 || statusValue === true;
        return {
          chainId,
          txHash,
          status: confirmed ? "confirmed" : "failed",
          blockNumber: blockHex ? parseInt(blockHex, 16) : undefined,
        };
      }

      const vmState = String((receipt as any)?.executions?.[0]?.vmstate || "");
      const failed = vmState.toUpperCase().includes("FAULT");
      return {
        chainId,
        txHash,
        status: failed ? "failed" : "confirmed",
        blockNumber: (receipt as any)?.blockindex,
      };
    }

    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  return { chainId, txHash, status: "pending" };
}

async function handleCallContract(payload: unknown): Promise<unknown> {
  const request = payload as ContractCallRequest;
  if (!request?.chainId || !request?.contractAddress || !request?.method) {
    throw new Error("chainId, contractAddress, and method are required");
  }

  const chainType = getChainTypeFromId(request.chainId);
  if (chainType !== "evm") {
    throw new Error("contract calls are only supported for EVM chains");
  }

  const data = resolveCallData(request.method, request.data, request.args);
  const txHash = await sendEvmTransaction(request.chainId, {
    to: request.contractAddress,
    value: request.value,
    data,
  });

  return { chainId: request.chainId, txHash, status: "pending" };
}

async function handleReadContract(payload: unknown): Promise<unknown> {
  const request = payload as ContractReadRequest;
  if (!request?.chainId || !request?.contractAddress || !request?.method) {
    throw new Error("chainId, contractAddress, and method are required");
  }

  const chainType = getChainTypeFromId(request.chainId);
  if (chainType === "evm") {
    const data = resolveCallData(request.method, request.data, request.args);
    const result = await evmCall(request.contractAddress, data, request.chainId);
    const response: ContractReadResult = { chainId: request.chainId, data: result };
    return response;
  }

  const result = await invokeRead(request.contractAddress, request.method, request.args || [], request.chainId);
  const response: ContractReadResult = { chainId: request.chainId, data: result };
  return response;
}

function emitSubscriptionEvent(entry: SubscriptionEntry, subscriptionId: string, event: unknown) {
  entry.target.postMessage(
    {
      id: subscriptionId,
      type: "MULTICHAIN_EVENT",
      payload: { subscriptionId, event },
    },
    entry.origin || "*",
  );
}

async function pollSubscription(subscriptionId: string, entry: SubscriptionEntry) {
  if (entry.isPolling) return;
  entry.isPolling = true;

  try {
    const { chainId, type, contractAddress } = entry.filter;
    if (type !== "contract" || !contractAddress) return;

    const latestBlock = await evmGetBlockNumber(chainId);
    const fromBlock = Math.max(entry.lastBlock + 1, 0);
    if (fromBlock > latestBlock) return;

    const logs = await rpcCall<unknown[]>(
      "eth_getLogs",
      [
        {
          address: contractAddress,
          fromBlock: `0x${fromBlock.toString(16)}`,
          toBlock: `0x${latestBlock.toString(16)}`,
        },
      ],
      chainId,
    );

    if (Array.isArray(logs)) {
      logs.forEach((log: any) => {
        emitSubscriptionEvent(entry, subscriptionId, {
          chainId,
          type,
          blockNumber: log?.blockNumber ? parseInt(log.blockNumber, 16) : latestBlock,
          txHash: log?.transactionHash,
          data: log,
          timestamp: Date.now(),
        });
      });
    }

    entry.lastBlock = latestBlock;
  } finally {
    entry.isPolling = false;
  }
}

async function handleSubscribe(payload: unknown, context: HandlerContext): Promise<void> {
  const { subscriptionId, filter } = payload as { subscriptionId?: string; filter?: EventFilter };
  if (!subscriptionId || !filter) {
    throw new Error("subscriptionId and filter are required");
  }

  if (!context.source || typeof (context.source as Window).postMessage !== "function") {
    throw new Error("Invalid subscription source");
  }

  if (subscriptions.has(subscriptionId)) {
    throw new Error("Subscription already exists");
  }

  if (filter.type !== "contract" || !filter.contractAddress) {
    throw new Error("Only contract event subscriptions are supported");
  }

  if (getChainTypeFromId(filter.chainId) !== "evm") {
    throw new Error("Event subscriptions are only supported for EVM chains");
  }

  const latestBlock = await evmGetBlockNumber(filter.chainId);
  const fromBlock =
    typeof filter.fromBlock === "number" ? Math.max(filter.fromBlock - 1, 0) : latestBlock;

  const entry: SubscriptionEntry = {
    filter,
    target: context.source as Window,
    origin: context.origin || "*",
    intervalId: 0,
    lastBlock: fromBlock,
    isPolling: false,
  };

  entry.intervalId = window.setInterval(() => {
    pollSubscription(subscriptionId, entry).catch(() => { });
  }, SUBSCRIPTION_POLL_MS);

  subscriptions.set(subscriptionId, entry);
  await pollSubscription(subscriptionId, entry);
}

async function handleUnsubscribe(payload: unknown): Promise<void> {
  const { subscriptionId } = payload as { subscriptionId?: string };
  if (!subscriptionId) {
    throw new Error("subscriptionId is required");
  }

  const entry = subscriptions.get(subscriptionId);
  if (!entry) return;
  clearInterval(entry.intervalId);
  subscriptions.delete(subscriptionId);
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
