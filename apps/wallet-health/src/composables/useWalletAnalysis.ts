/**
 * useWalletAnalysis — Chain data and balance analysis for Wallet Health
 *
 * Receives the MiniApp framework SDK (ctx.framework): wallet identity and
 * NEO/GAS balance reads go through app.wallet instead of hand-rolled
 * ChainService balanceOf reads.
 */

import { createObservable, createDerived } from "@shared/react/context";
import type { MiniAppFramework } from "@shared/react";
import { formatFixed8 } from "@shared/utils/format";
import { addressToScriptHash } from "@shared/utils/neo";
import type { MiniAppLaunchNetwork } from "@shared/utils/launch-params";

const GAS_LOW_THRESHOLD = 10000000n;
export const WALLET_CONNECT_TIMEOUT_MS = 12_000;
export const WALLET_READ_TIMEOUT_MS = 15_000;

export type WalletDataStatus =
  | "disconnected"
  | "idle"
  | "connecting"
  | "refreshing"
  | "fresh"
  | "partial"
  | "error";

/**
 * Evidence outcome for an individual read. `zero` is deliberately separate
 * from `pass`: a confirmed zero balance must never be confused with an unread
 * or failed RPC response.
 */
export type WalletEvidenceStatus =
  | "unknown"
  | "reading"
  | "failed"
  | "zero"
  | "pass";

export interface UseWalletAnalysisOptions {
  /** MiniApp framework SDK from ctx.framework. */
  app: MiniAppFramework;
  /** Network selected by the host launch context. */
  targetNetwork?: MiniAppLaunchNetwork | null;
  t: (key: string, params?: Record<string, string | number>) => string;
}

function normalizedNeoNetwork(value: unknown): "mainnet" | "testnet" | null {
  const raw = String(value ?? "").trim().toLowerCase();
  if (raw === "mainnet" || raw === "neo-n3-mainnet") return "mainnet";
  if (raw === "testnet" || raw === "neo-n3-testnet") return "testnet";
  return null;
}

function networkDisplay(value: "mainnet" | "testnet" | null): string {
  if (value === "mainnet") return "Neo N3 MainNet";
  if (value === "testnet") return "Neo N3 TestNet";
  return "—";
}

function evidenceStatus(value: bigint): WalletEvidenceStatus {
  return value === 0n ? "zero" : "pass";
}

async function readWithTimeout<T>(promise: Promise<T>, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_resolve, reject) => {
        timer = globalThis.setTimeout(
          () => reject(new Error(message)),
          WALLET_READ_TIMEOUT_MS,
        );
      }),
    ]);
  } finally {
    if (timer !== undefined) globalThis.clearTimeout(timer);
  }
}

export function useWalletAnalysis({ app, targetNetwork, t }: UseWalletAnalysisOptions) {
  const isRefreshing = createObservable(false);
  const isConnecting = createObservable(false);
  const balanceRevision = createObservable(0);
  const dataStatus = createObservable<WalletDataStatus>(
    app.wallet.isConnected() ? "idle" : "disconnected",
  );
  const lastUpdatedAt = createObservable(0);
  const lastError = createObservable("");
  const neoObservedAt = createObservable(0);
  const gasObservedAt = createObservable(0);
  const neoReadStatus = createObservable<WalletEvidenceStatus>("unknown");
  const gasReadStatus = createObservable<WalletEvidenceStatus>("unknown");
  const networkReadStatus = createObservable<WalletEvidenceStatus>("unknown");
  const walletNetworkLabel = createObservable("—");
  const networkMismatch = createObservable(false);

  const balances = {
    neo: 0n,
    gas: 0n,
  };

  const gasOk = createDerived(() => balances.gas >= GAS_LOW_THRESHOLD, [balanceRevision]);
  const neoDisplay = createDerived(() => balances.neo.toString(), [balanceRevision]);
  const gasDisplay = createDerived(() => formatFixed8(balances.gas, 4), [balanceRevision]);

  let identityRevision = 0;
  let activeRefresh: { address: string; promise: Promise<void> } | null = null;

  const clearBalances = () => {
    balances.neo = 0n;
    balances.gas = 0n;
    balanceRevision.set(balanceRevision.get() + 1);
    neoObservedAt.set(0);
    gasObservedAt.set(0);
    neoReadStatus.set("unknown");
    gasReadStatus.set("unknown");
  };

  const handleAddressChange = (address: string | null) => {
    identityRevision += 1;
    clearBalances();
    lastUpdatedAt.set(0);
    lastError.set("");
    networkReadStatus.set("unknown");
    walletNetworkLabel.set("—");
    networkMismatch.set(false);
    dataStatus.set(address ? "idle" : "disconnected");
    isRefreshing.set(false);
    if (!address) isConnecting.set(false);
  };

  const refreshBalances = async () => {
    const address = app.wallet.address();
    if (!address) {
      handleAddressChange(null);
      return;
    }
    if (activeRefresh?.address === address) return activeRefresh.promise;

    // The wallet surface intentionally returns 0n when it cannot convert an
    // owner in its fallback lane. Validate first so a malformed host identity
    // is reported as failed evidence instead of a confirmed zero balance.
    if (!addressToScriptHash(address)) {
      neoReadStatus.set("failed");
      gasReadStatus.set("failed");
      networkReadStatus.set("unknown");
      lastError.set(t("walletAddressInvalid"));
      dataStatus.set("error");
      throw new Error(t("walletAddressInvalid"));
    }

    const requestRevision = identityRevision;
    isRefreshing.set(true);
    lastError.set("");
    dataStatus.set("refreshing");
    neoReadStatus.set("reading");
    gasReadStatus.set("reading");
    networkReadStatus.set("reading");

    const run = (async () => {
      // Keep NEO, GAS, and wallet-network reads independent. One RPC failure
      // must not erase another successful result or publish an all-green state.
      const [neoResult, gasResult, networkResult] = await Promise.allSettled([
        readWithTimeout(app.wallet.raw("NEO", address), t("walletReadTimeout")),
        readWithTimeout(app.wallet.raw("GAS", address), t("walletReadTimeout")),
        readWithTimeout(app.chain.detectNetwork(), t("walletReadTimeout")),
      ]);
      // A response for an address that has since disconnected/switched is
      // irrelevant, including its error. Never overwrite the newer account.
      if (requestRevision !== identityRevision || app.wallet.address() !== address) return;

      const observedAt = Date.now();
      let successfulBalanceReads = 0;

      if (neoResult.status === "fulfilled") {
        balances.neo = neoResult.value;
        neoObservedAt.set(observedAt);
        neoReadStatus.set(evidenceStatus(neoResult.value));
        successfulBalanceReads += 1;
      } else {
        neoReadStatus.set("failed");
      }

      if (gasResult.status === "fulfilled") {
        balances.gas = gasResult.value;
        gasObservedAt.set(observedAt);
        gasReadStatus.set(evidenceStatus(gasResult.value));
        successfulBalanceReads += 1;
      } else {
        gasReadStatus.set("failed");
      }

      if (successfulBalanceReads > 0) {
        balanceRevision.set(balanceRevision.get() + 1);
        lastUpdatedAt.set(observedAt);
      }

      if (networkResult.status === "fulfilled") {
        const walletNetwork = normalizedNeoNetwork(networkResult.value);
        walletNetworkLabel.set(networkDisplay(walletNetwork));
        const target = normalizedNeoNetwork(targetNetwork);
        if (!walletNetwork) {
          networkReadStatus.set("unknown");
          networkMismatch.set(false);
        } else if (target && walletNetwork !== target) {
          networkReadStatus.set("failed");
          networkMismatch.set(true);
        } else {
          networkReadStatus.set("pass");
          networkMismatch.set(false);
        }
      } else {
        networkReadStatus.set("failed");
        walletNetworkLabel.set("—");
        networkMismatch.set(false);
      }

      if (successfulBalanceReads === 2) {
        dataStatus.set("fresh");
        return;
      }

      lastError.set(successfulBalanceReads === 1 ? t("refreshPartial") : t("refreshFailed"));
      dataStatus.set(successfulBalanceReads === 1 ? "partial" : "error");

      // A partial result is useful and stays visible without a misleading
      // success verdict. A total failure still rejects so the standard action
      // boundary emits the localized retry toast.
      if (successfulBalanceReads === 0) {
        const firstError = neoResult.status === "rejected"
          ? neoResult.reason
          : gasResult.status === "rejected"
            ? gasResult.reason
            : new Error(t("refreshFailed"));
        throw firstError instanceof Error ? firstError : new Error(t("refreshFailed"));
      }
    })();

    activeRefresh = { address, promise: run };
    try {
      await run;
    } finally {
      if (activeRefresh?.promise === run) {
        activeRefresh = null;
        isRefreshing.set(false);
      }
    }
  };

  const ensureWithTimeout = async (): Promise<void> => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        app.wallet.ensure(),
        new Promise<never>((_resolve, reject) => {
          timer = globalThis.setTimeout(
            () => reject(new Error(t("walletConnectTimeout"))),
            WALLET_CONNECT_TIMEOUT_MS,
          );
        }),
      ]);
    } finally {
      if (timer !== undefined) globalThis.clearTimeout(timer);
    }
  };

  const connectWallet = async () => {
    // In-flight guard: wallet.ensure() opens a wallet prompt and leaves the
    // address null while pending, so isConnected stays false and the button
    // remains clickable. Gate entry before the first await to stop repeated
    // taps from triggering concurrent ensure() calls / duplicate popups.
    if (isConnecting.get()) return;

    try {
      isConnecting.set(true);
      lastError.set("");
      dataStatus.set("connecting");
      await ensureWithTimeout();
      if (!app.wallet.isConnected()) throw new Error(t("walletNotConnected"));
      await refreshBalances();
    } catch (e) {
      const error = e instanceof Error ? e : new Error(t("walletNotConnected"));
      if (!lastError.get()) {
        const timeoutMessage = t("walletConnectTimeout");
        lastError.set(error.message === timeoutMessage ? timeoutMessage : t("walletNotConnected"));
      }
      dataStatus.set("error");
      throw error;
    } finally {
      isConnecting.set(false);
    }
  };

  return {
    address: app.wallet.observe(),
    isRefreshing,
    isConnecting,
    dataStatus,
    lastUpdatedAt,
    lastError,
    neoObservedAt,
    gasObservedAt,
    neoReadStatus,
    gasReadStatus,
    networkReadStatus,
    walletNetworkLabel,
    networkMismatch,
    balances,
    gasOk,
    neoDisplay,
    gasDisplay,
    refreshBalances,
    connectWallet,
    handleAddressChange,
  };
}
