/**
 * Neo N3 Bridge Handler
 *
 * Handles messages from miniapp SDK and routes to Neo services.
 */

import type { BridgeMessage, BridgeResponse, MessageType } from "./types";
import type { ChainId } from "../chains/types";
import { getChainRegistry } from "../chains/registry";
import { useWalletStore } from "../wallet/store";
import type { WalletProvider } from "../wallet/store";
import { getTransactionLogMultiChain, invokeRead } from "../chains/rpc-functions";

type HandlerContext = {
  source?: MessageEventSource | null;
  origin?: string;
};

type Handler = (payload: unknown, context: HandlerContext) => Promise<unknown>;

/**
 * Error thrown when a cross-origin embedded miniapp requests wallet identity
 * or balance without a prior one-time consent grant for its origin.
 *
 * The host UI should catch `CONSENT_REQUIRED`, prompt the user, and on approval
 * call `useWalletStore.getState().grantBridgeConsent(origin)` before retrying.
 */
const CONSENT_REQUIRED_CODE = "CONSENT_REQUIRED";

class BridgeConsentError extends Error {
  readonly code = CONSENT_REQUIRED_CODE;
  constructor(origin: string) {
    super(`Wallet access not granted for origin: ${origin || "unknown"}`);
    this.name = "BridgeConsentError";
  }
}

/**
 * Returns the host's own origin, or null when not running in a browser
 * (e.g. SSR / unit tests). A null host origin means we cannot prove the
 * request is cross-origin, so it is treated as first-party.
 */
function getHostOrigin(): string | null {
  if (typeof window === "undefined" || !window.location) return null;
  return window.location.origin || null;
}

/**
 * Determines whether a bridge request originates from a cross-origin embedded
 * context (a third-party miniapp iframe) versus a first-party/same-origin or
 * in-process caller.
 *
 * - No origin in context (in-process call, unit tests) => first-party.
 * - Origin equal to the host origin => first-party (same-origin embed).
 * - Opaque "null" origin (sandboxed iframe without allow-same-origin) =>
 *   treated as cross-origin (cannot be trusted, no stable consent key).
 * - Any other origin => cross-origin.
 */
function isCrossOrigin(context: HandlerContext): boolean {
  const origin = String(context.origin || "").trim();
  if (!origin) return false; // in-process / SSR / tests
  const host = getHostOrigin();
  if (host && origin === host) return false; // same-origin embed
  return true;
}

/**
 * Guards wallet identity/balance reads behind a one-time per-origin consent.
 * First-party callers are always allowed. Cross-origin embedded miniapps must
 * have an explicit, persisted consent grant for their origin; otherwise a
 * `CONSENT_REQUIRED` error is thrown instead of silently leaking the wallet.
 */
function assertReadConsent(context: HandlerContext): void {
  if (!isCrossOrigin(context)) return;
  const origin = String(context.origin || "").trim();
  // Opaque "null" origins have no stable identity to bind consent to; deny.
  if (!origin || origin === "null") {
    throw new BridgeConsentError(origin);
  }
  if (!useWalletStore.getState().hasBridgeConsent(origin)) {
    throw new BridgeConsentError(origin);
  }
}

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
    const code =
      err instanceof BridgeConsentError
        ? CONSENT_REQUIRED_CODE
        : "HANDLER_ERROR";
    return {
      id: message.id,
      success: false,
      error: {
        code,
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

async function handleGetActiveChain(_payload: unknown, context: HandlerContext): Promise<unknown> {
  assertReadConsent(context);
  const store = useWalletStore.getState();
  if (!store.chainId) return null;
  const registry = getChainRegistry();
  return registry.getChain(store.chainId);
}

async function handleSwitchChain(payload: unknown): Promise<void> {
  const { chainId } = payload as { chainId: string };
  const store = useWalletStore.getState();
  await store.switchChain(chainId as ChainId);
}

async function handleConnect(payload: unknown, context: HandlerContext): Promise<unknown> {
  assertReadConsent(context);
  const { chainId, provider = "neoline" } = (payload as { chainId?: string; provider?: string }) || {};
  if (!chainId) {
    throw new Error("chainId is required for wallet connection");
  }
  const registry = getChainRegistry();
  if (!registry.getChain(chainId as ChainId)) {
    throw new Error(`Unknown chain: ${chainId}`);
  }
  if (!["neoline", "o3", "onegate"].includes(provider)) {
    throw new Error(`Unsupported provider: ${provider}`);
  }
  const store = useWalletStore.getState();
  await store.connect(provider as WalletProvider, chainId as ChainId);
  const updated = useWalletStore.getState();
  if (!updated.connected) {
    throw new Error("Wallet connection failed");
  }
  return {
    chainId: updated.chainId,
    address: updated.address,
    publicKey: updated.publicKey,
  };
}

async function handleDisconnect(): Promise<void> {
  const store = useWalletStore.getState();
  store.disconnect();
}

async function handleGetAccount(payload: unknown, context: HandlerContext): Promise<unknown> {
  assertReadConsent(context);
  const { chainId } = (payload as { chainId?: string }) || {};
  const store = useWalletStore.getState();
  const targetChain = (chainId || store.chainId) as ChainId | null;
  if (!targetChain || !store.connected) return null;
  return {
    chainId: targetChain,
    address: store.address,
    publicKey: store.publicKey,
    balance: store.balance ? { native: store.balance.native, tokens: store.balance.tokens } : undefined,
  };
}

async function handleSendTx(payload: unknown): Promise<unknown> {
  const request = payload as SdkTransactionRequest;
  if (!request?.chainId || !request?.to) {
    throw new Error("chainId and to are required");
  }
  throw new Error("sendTransaction is not supported on neo-n3");
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
      const vmState = String((receipt as { executions?: Array<{ vmstate?: string }> })?.executions?.[0]?.vmstate ?? "");
      const failed = vmState.toUpperCase().includes("FAULT");
      return {
        chainId,
        txHash,
        status: failed ? "failed" : "confirmed",
        blockNumber: (receipt as { blockindex?: number })?.blockindex,
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
  throw new Error("contract calls are not supported on neo-n3");
}

async function handleReadContract(payload: unknown): Promise<unknown> {
  const request = payload as ContractReadRequest;
  if (!request?.chainId || !request?.contractAddress || !request?.method) {
    throw new Error("chainId, contractAddress, and method are required");
  }

  const result = await invokeRead(request.contractAddress, request.method, request.args || [], request.chainId);
  const response: ContractReadResult = { chainId: request.chainId, data: result };
  return response;
}

async function handleSubscribe(): Promise<void> {
  throw new Error("Event subscriptions are not supported on neo-n3");
}

async function handleUnsubscribe(): Promise<void> {
  return;
}

async function handleGetBalance(payload: unknown, context: HandlerContext): Promise<string> {
  const { chainId, address } = payload as { chainId: string; address?: string };
  // Reading the connected wallet's balance leaks identity-linked data; gate it.
  // An explicit foreign address (already known to the caller) is not gated,
  // but defaulting to the host wallet address requires consent.
  if (!address) {
    assertReadConsent(context);
  }
  const registry = getChainRegistry();
  const chain = registry.getChain(chainId as ChainId);
  if (!chain) throw new Error("Chain not found");

  // Get address from store if not provided
  const store = useWalletStore.getState();
  const targetAddress = address || store.address;
  if (!targetAddress) throw new Error("No address");

  // Fetch balance via RPC
  const rpcUrl = chain.rpcUrls?.[0];
  if (!rpcUrl) throw new Error("No RPC URL");

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
