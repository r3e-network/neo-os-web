import { getWalletAdapter, useWalletStore } from "@/lib/wallet/store";
import type { NeoWalletNetwork } from "@/lib/wallet/adapters";

import type { BridgeInvocation, SendCapableWalletAdapter } from "./types";
import {
  GAS_ASSET_HASH,
  NEO_ASSET_HASH,
  asBridgeString,
  bridgeInvocationToParams,
  bridgeNetworkMagic,
  describeSensitiveBridgeOperation,
  isBridgeRecord,
  isSenderPlaceholder,
  normalizeBridgeSigners,
  resolveSenderArgs,
} from "./normalizers";

export function requireBridgeWallet(
  targetNetwork: "mainnet" | "testnet",
  options: { requireVerifiedNetwork?: boolean } = {},
) {
  const walletState = useWalletStore.getState();
  const adapter = getWalletAdapter();
  if (!walletState.connected || !walletState.address || !adapter) {
    throw new Error(
      "Connect wallet from the top navigation before submitting embedded dApp actions.",
    );
  }
  // Audit fix (network hardening): NEP-21 connections can yield network=null when
  // getNetwork fails. For fund-moving methods that null must fail closed — otherwise
  // the host could sign a testnet-targeted invoke with a wallet sitting on mainnet.
  if (options.requireVerifiedNetwork && !walletState.network) {
    throw new Error(
      "Wallet network is unverified — reconnect the wallet before submitting embedded dApp actions.",
    );
  }
  if (walletState.network && walletState.network !== targetNetwork) {
    throw new Error(
      `Wallet is on ${walletState.network} but this embedded dApp targets ${targetNetwork}.`,
    );
  }
  return { walletState, adapter };
}

function bridgeMethodRequiresVerifiedNetwork(method: string): boolean {
  return (
    method === "getBalance" ||
    method === "signMessage" ||
    method === "invoke" ||
    method === "send"
  );
}

async function readFreshWalletNetwork(
  adapter: ReturnType<typeof getWalletAdapter>,
): Promise<NeoWalletNetwork | null | undefined> {
  if (!adapter?.getNetwork) return undefined;
  try {
    return await adapter.getNetwork();
  } catch (_e: unknown) {
    return null;
  }
}

export async function requireFreshBridgeWallet(
  targetNetwork: "mainnet" | "testnet",
  options: { requireVerifiedNetwork?: boolean } = {},
) {
  const { walletState, adapter } = requireBridgeWallet(targetNetwork, {
    requireVerifiedNetwork: false,
  });
  const freshNetwork = await readFreshWalletNetwork(adapter);
  const effectiveNetwork =
    freshNetwork === undefined ? walletState.network : freshNetwork;
  if (freshNetwork !== undefined && freshNetwork !== walletState.network) {
    useWalletStore.setState({ network: freshNetwork });
  }
  if (options.requireVerifiedNetwork && !effectiveNetwork) {
    throw new Error(
      "Wallet network is unverified — reconnect the wallet before submitting embedded dApp actions.",
    );
  }
  if (effectiveNetwork && effectiveNetwork !== targetNetwork) {
    throw new Error(
      `Wallet is on ${effectiveNetwork} but this embedded dApp targets ${targetNetwork}.`,
    );
  }
  return {
    walletState: {
      ...walletState,
      network: effectiveNetwork,
    },
    adapter,
  };
}

export async function preflightEmbeddedWalletBridgeRequest(
  method: string,
  targetNetwork: "mainnet" | "testnet",
): Promise<void> {
  await requireFreshBridgeWallet(targetNetwork, {
    requireVerifiedNetwork: bridgeMethodRequiresVerifiedNetwork(method),
  });
}

async function invokeBridgeRead(
  invocation: BridgeInvocation,
  targetNetwork: "mainnet" | "testnet",
) {
  const params = bridgeInvocationToParams(invocation);
  const response = await fetch("/api/rpc/neo", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      network: targetNetwork,
      method: "invokefunction",
      params: [params.scriptHash, params.operation, params.args],
    }),
  });
  const payload = (await response.json().catch(() => null)) as
    | { result?: unknown; error?: unknown }
    | null;
  if (!response.ok || payload?.error) {
    const message = isBridgeRecord(payload?.error)
      ? asBridgeString(payload?.error.message)
      : asBridgeString(payload?.error);
    throw new Error(message || "Embedded dApp read failed.");
  }
  const result = payload?.result ?? payload;
  // A FAULTed read decodes to an empty/garbage stack that looks like a valid
  // zero result. Surface it as a failed bridge read (the bridge hook's catch
  // turns a throw into `{ ok: false }`) instead of handing the miniapp fake data.
  if (isBridgeRecord(result)) {
    const state = asBridgeString(result.state);
    if (state && state.toUpperCase() !== "HALT") {
      throw new Error(`Embedded dApp read faulted (state ${state}).`);
    }
  }
  return result;
}

// Audit fix (frontend bridge hardening): wallet methods that sign or move funds must not run
// silently on a miniapp's request. These require an explicit user confirmation in the host.
export const SENSITIVE_BRIDGE_METHODS = new Set(["signMessage", "invoke", "send"]);

export function confirmSensitiveBridgeOperation(
  appId: string,
  method: string,
  payload: unknown,
): boolean {
  // Runs only client-side (invoked from a message handler), but fail closed if no
  // confirmation primitive is available rather than approving a fund-moving op silently.
  if (typeof window === "undefined" || typeof window.confirm !== "function") return false;
  const description = describeSensitiveBridgeOperation(method, payload);
  return window.confirm(
    `"${appId}" is asking your wallet to ${description}.\n\nApprove this request?`,
  );
}

function senderKey(value: string): string {
  const raw = value.trim().toLowerCase();
  return raw.startsWith("0x") ? raw.slice(2) : raw;
}

function isConnectedWalletSender(
  requested: string,
  walletState: { address: string; accountHash?: string },
): boolean {
  if (!requested) return true;
  const requestedKey = senderKey(requested);
  return [walletState.address, walletState.accountHash || ""]
    .filter(Boolean)
    .some((value) => senderKey(value) === requestedKey);
}

export async function handleEmbeddedWalletBridgeRequest(
  method: string,
  payload: unknown,
  targetNetwork: "mainnet" | "testnet",
) {
  if (method === "call") {
    const invocation = isBridgeRecord(payload)
      ? (payload.invocation as BridgeInvocation)
      : null;
    if (!isBridgeRecord(invocation)) {
      throw new Error("Embedded dApp read request is missing invocation.");
    }
    return invokeBridgeRead(invocation, targetNetwork);
  }

  const { walletState, adapter } = await requireFreshBridgeWallet(targetNetwork, {
    requireVerifiedNetwork: bridgeMethodRequiresVerifiedNetwork(method),
  });
  if (method === "getAccounts") {
    const hash = walletState.accountHash || walletState.address;
    return [
      {
        hash,
        accountHash: walletState.accountHash || undefined,
        address: walletState.address,
        label: "Host wallet",
        isDefault: true,
      },
    ];
  }
  if (method === "authenticate") {
    // Report the wallet's *verified* network, not the target network the host
    // wishes for. A NEP-21 connection whose getNetwork failed leaves
    // walletState.network null — surface that as networkVerified:false rather
    // than asserting a magic the wallet may not actually be on.
    const verifiedNetwork = walletState.network;
    return {
      network: verifiedNetwork
        ? bridgeNetworkMagic(verifiedNetwork)
        : null,
      networkVerified: Boolean(verifiedNetwork),
      address: walletState.address,
      accountHash: walletState.accountHash || undefined,
      pubkey: walletState.publicKey || undefined,
    };
  }
  if (method === "getBalance") {
    const balance = await adapter.getBalance(walletState.address);
    const asset = asBridgeString(isBridgeRecord(payload) ? payload.asset : "");
    if (asset === "NEO" || asset.toLowerCase() === NEO_ASSET_HASH) return balance.neo;
    if (asset === "GAS" || asset.toLowerCase() === GAS_ASSET_HASH) return balance.gas;
    return { [NEO_ASSET_HASH]: balance.neo, [GAS_ASSET_HASH]: balance.gas };
  }
  if (method === "signMessage") {
    const message = asBridgeString(isBridgeRecord(payload) ? payload.message : "");
    return adapter.signMessage(message);
  }
  if (method === "invoke") {
    const invocations = isBridgeRecord(payload) && Array.isArray(payload.invocations)
      ? payload.invocations.filter(isBridgeRecord)
      : [];
    if (!invocations.length) {
      throw new Error("Embedded dApp wallet request has no invocations.");
    }
    const signers = normalizeBridgeSigners(
      isBridgeRecord(payload) ? payload.signers : undefined,
    );
    const params = invocations.map((invocation) =>
      resolveSenderArgs(bridgeInvocationToParams(invocation, signers), walletState.address),
    );
    if (params.length > 1) {
      if (!adapter.invokeMultiple) {
        throw new Error("Connected wallet does not support batched embedded dApp invokes.");
      }
      return adapter.invokeMultiple(params, signers);
    }
    return adapter.invoke(params[0]!);
  }
  if (method === "send") {
    const sendAdapter = adapter as SendCapableWalletAdapter;
    if (!sendAdapter.send || !isBridgeRecord(payload)) {
      throw new Error("Connected wallet does not support embedded dApp transfers.");
    }
    const asset = asBridgeString(payload.asset);
    const amount = asBridgeString(payload.amount);
    const to = asBridgeString(payload.to);
    const requestedFrom = asBridgeString(payload.from);
    const from = isSenderPlaceholder(requestedFrom)
      ? walletState.accountHash || walletState.address
      : requestedFrom || undefined;
    if (from && !isConnectedWalletSender(from, walletState)) {
      throw new Error(
        "Embedded dApp transfer sender does not match the connected wallet.",
      );
    }
    if (!asset || !amount || !to) {
      throw new Error("Embedded dApp transfer request is incomplete.");
    }
    return sendAdapter.send(asset, amount, to, from);
  }
  throw new Error(`Unsupported embedded wallet method: ${method}`);
}
