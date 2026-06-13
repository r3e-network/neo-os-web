import { getWalletAdapter, useWalletStore } from "@/lib/wallet/store";

import type { BridgeInvocation, SendCapableWalletAdapter } from "./types";
import {
  GAS_ASSET_HASH,
  NEO_ASSET_HASH,
  asBridgeString,
  bridgeInvocationToParams,
  bridgeNetworkMagic,
  describeSensitiveBridgeOperation,
  isBridgeRecord,
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
  return payload?.result ?? payload;
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

  const { walletState, adapter } = requireBridgeWallet(targetNetwork, {
    requireVerifiedNetwork: method === "invoke" || method === "send",
  });
  if (method === "getAccounts") {
    return [
      {
        hash: walletState.address,
        address: walletState.address,
        label: "Host wallet",
        isDefault: true,
      },
    ];
  }
  if (method === "authenticate") {
    return {
      network: bridgeNetworkMagic(targetNetwork),
      address: walletState.address,
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
    const from = asBridgeString(payload.from) || undefined;
    if (!asset || !amount || !to) {
      throw new Error("Embedded dApp transfer request is incomplete.");
    }
    return sendAdapter.send(asset, amount, to, from);
  }
  throw new Error(`Unsupported embedded wallet method: ${method}`);
}
