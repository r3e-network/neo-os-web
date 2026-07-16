/** Developer Tipping standalone entrypoint. */

import { defineMiniApp, createObservable, refsToObservables } from "@shared/react";
import { createDerived, createReadCell } from "@shared/react/context";
import { ownerMatchesAddress } from "@shared/utils/neo";
import PlayArea from "./PlayArea";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import { useDevTippingStats, type WalletSnapshot } from "./composables/useDevTippingStats";
import {
  useDevTippingWallet,
  type DevTippingActionOutcome,
} from "./composables/useDevTippingWallet";
import {
  attestDevTippingContract,
  readDevTippingExecutionState,
} from "./dev-tipping-rpc";

defineMiniApp({
  appId: "miniapp-dev-tipping",
  playArea: PlayArea,
  manifest,
  messages,

  setup(ctx) {
    const t = ctx.t as (key: string, params?: Record<string, string | number>) => string;
    const stats = useDevTippingStats({ app: ctx.framework, t });
    const wallet = useDevTippingWallet({
      app: ctx.framework,
      t,
      launchNetwork: ctx.launchContext?.network,
      attestContract: attestDevTippingContract,
      readExecutionState: readDevTippingExecutionState,
    });

    const developerCount = createObservable(0);
    // Carries the value only — an empty string means "nothing to show yet".
    // What that absence looks like is the view's call, not this layer's.
    const totalDonatedDisplay = createObservable("");
    /**
     * True once `refresh` has resolved whether the board's public totals can be
     * read at all. `totalDonatedDisplay` alone could not say why it was empty:
     * a wallet-less visitor bails out of `refresh` before the read (the runtime
     * cannot name a network yet), so the display stayed at its initial value
     * FOREVER — a permanent em-dash on the support drawer's History tab, with
     * nothing to explain it. Settling that bail-out lets the view say so.
     */
    const statsSettled = createObservable(false);
    const recentTipCount = createObservable(0);
    const myClaimableBalance = createObservable(0);
    const myClaimableBalanceDisplay = createObservable("—");
    const hasClaimableBalance = createObservable(false);
    const isConnecting = createObservable(false);
    let refreshGeneration = 0;

    /**
     * The wallet lane on the platform read-cell (read-cell pilot): one cell
     * owns the snapshot plus the "have we asked yet?" signal that the old
     * hand-rolled walletReadStatus/walletReadError pair carried, and the
     * seven per-field observables below become deriveds of it. The address
     * is threaded through this variable because the loader runs synchronously
     * inside load(): each caller writes it immediately before loading, so an
     * overlapping load cannot observe another call's address.
     */
    let walletReadAddress = "";
    const walletCell = createReadCell<WalletSnapshot>(
      () => stats.loadWalletSnapshot(walletReadAddress),
    );
    const myDeveloperId = createDerived(
      () => walletCell.value.get()?.developerId ?? 0,
      [walletCell.value],
    );
    const myCredit = createDerived(
      () => {
        const snapshot = walletCell.value.get();
        if (!snapshot) return 0;
        const creditGas = Number(snapshot.creditBase) / 1e8;
        return Number.isFinite(creditGas) ? creditGas : Number.MAX_VALUE;
      },
      [walletCell.value],
    );
    const myCreditDisplay = createDerived(
      () => {
        const snapshot = walletCell.value.get();
        return snapshot ? `${ctx.framework.amount.fixed8ToGas(snapshot.creditBase, 8)} GAS` : "—";
      },
      [walletCell.value],
    );
    const hasCredit = createDerived(
      () => (walletCell.value.get()?.creditBase ?? 0n) > 0n,
      [walletCell.value],
    );
    const gasBalanceDisplay = createDerived(
      () => {
        const snapshot = walletCell.value.get();
        return snapshot ? `${ctx.framework.amount.fixed8ToGas(snapshot.gasBalanceBase, 8)} GAS` : "—";
      },
      [walletCell.value],
    );
    const walletReadStatus = walletCell.status;
    const walletReadError = createDerived(
      () => (walletCell.status.get() === "error" ? t("walletSnapshotUnavailable") : ""),
      [walletCell.status],
    );

    const clearWalletSnapshot = () => {
      // reset() puts every wallet derived back on its pre-read rendering
      // (id 0, credit 0/"—", gas "—", status "idle", error "") and
      // invalidates any in-flight read's publish.
      walletCell.reset();
      myClaimableBalance.set(0);
      myClaimableBalanceDisplay.set("—");
      hasClaimableBalance.set(false);
    };

    const syncMyDeveloper = (address: string) => {
      const developerId = myDeveloperId.get();
      let registered = developerId > 0
        ? stats.developers.get().find((developer) => developer.id === developerId)
        : undefined;
      if (!registered && address) {
        registered = stats.developers.get().find(
          (developer) => developer.wallet && ownerMatchesAddress(developer.wallet, address),
        );
        if (registered) {
          // Blessed value.set (read-cell pilot): the registry read just
          // proved this wallet owns `registered.id`, refining the snapshot's
          // developerId with equally-verified truth.
          const snapshot = walletCell.value.get();
          if (snapshot) walletCell.value.set({ ...snapshot, developerId: registered.id });
        }
      }
      if (!registered) {
        myClaimableBalance.set(0);
        myClaimableBalanceDisplay.set("0 GAS");
        hasClaimableBalance.set(false);
        return;
      }
      const balanceBase = BigInt(registered.balanceBase);
      myClaimableBalance.set(registered.balance);
      myClaimableBalanceDisplay.set(
        `${ctx.framework.amount.fixed8ToGas(balanceBase, 8)} GAS`,
      );
      hasClaimableBalance.set(balanceBase > 0n);
    };

    const loadWalletSnapshot = async (
      address: string,
      generation: number,
    ): Promise<boolean> => {
      walletReadAddress = address;
      await walletCell.load();
      // KEPT explicit cross-check: reset-on-account-change covers an address
      // that changed (chain.address notifies synchronously and the handler
      // resets the cell), but a refresh superseded mid-read WITHOUT a wallet
      // lane op — runtime turned incompatible, registry read threw — bumps
      // only refreshGeneration. That generation must still stop this call's
      // continuation (syncMyDeveloper/restoreRecovery) here.
      if (
        generation !== refreshGeneration
        || !ownerMatchesAddress(ctx.framework.chain.address.get() ?? "", address)
      ) return false;
      return true;
    };

    const refresh = async (): Promise<boolean> => {
      const generation = ++refreshGeneration;
      const addressAtStart = wallet.address.get() ?? "";
      await wallet.refreshRuntime(addressAtStart || null);
      if (generation !== refreshGeneration) return false;
      // Waiting for a wallet is the expected first-load state, not a load
      // failure. Throwing here surfaced a console error on every cold open.
      if (wallet.runtimeStatus.get() === "awaiting-wallet") {
        // Not a fault, and not still-loading either: without a wallet the
        // runtime cannot resolve which network to read the board from, so the
        // totals are genuinely unreadable rather than pending. Say so, or the
        // view would shimmer forever waiting for a read that never starts.
        statsSettled.set(true);
        return false;
      }
      if (!wallet.runtimeCompatible.get()) {
        throw new Error(wallet.runtimeError.get() || t("runtimeUnavailable"));
      }

      await stats.loadDevelopers();
      if (generation !== refreshGeneration) return false;
      await stats.loadRecentTips();
      if (generation !== refreshGeneration) return false;
      developerCount.set(stats.developers.get().length);
      totalDonatedDisplay.set(
        `${ctx.framework.amount.fixed8ToGas(stats.totalDonatedBase.get(), 8)} GAS`,
      );
      statsSettled.set(true);
      recentTipCount.set(stats.recentTips.get().length);

      if (!addressAtStart) {
        clearWalletSnapshot();
        wallet.clearRecoveryView();
        return true;
      }
      if (!ownerMatchesAddress(wallet.address.get() ?? "", addressAtStart)) return false;
      if (!await loadWalletSnapshot(addressAtStart, generation)) return false;
      syncMyDeveloper(addressAtStart);
      await wallet.restoreRecovery();
      return generation === refreshGeneration;
    };

    const refreshAfterWrite = async () => {
      try {
        await refresh();
      } catch {
        ctx.framework.notify.info("dataRefreshPending");
      }
    };

    const runWrite = async (
      work: () => Promise<DevTippingActionOutcome>,
      successKey: string,
    ): Promise<DevTippingActionOutcome | false> => {
      if (isConnecting.get()) {
        ctx.framework.notify.info("operationBusy");
        return false;
      }
      const result = await ctx.framework.notify.guardResult(work);
      if (!result.ok) return false;
      if (result.value === "confirmed") {
        ctx.framework.notify.success(successKey);
        await refreshAfterWrite();
      } else {
        ctx.framework.notify.info("receiptPending");
      }
      return result.value;
    };

    ctx.framework.actions.register("connect", async () => {
      if (
        isConnecting.get()
        || wallet.isLoading.get()
        || wallet.isRegistering.get()
        || wallet.isWithdrawing.get()
        || wallet.isRecovering.get()
      ) {
        ctx.framework.notify.info("operationBusy");
        return false;
      }
      isConnecting.set(true);
      try {
        const result = await ctx.framework.notify.guardResult(async () => {
          const address = await ctx.framework.chain.ensureWallet();
          if (!address) throw new Error(t("walletNotConnected"));
          return address;
        });
        if (!result.ok) return false;
        ctx.framework.notify.success("walletConnected");
        await refreshAfterWrite();
        return true;
      } finally {
        isConnecting.set(false);
      }
    });

    ctx.framework.actions.register("sendTip", async (...args: unknown[]) =>
      runWrite(
        () => wallet.sendTip(
          Number(args[0]),
          String(args[1] ?? ""),
          "",
          "",
          args[2] === true,
        ),
        "tipSent",
      ),
    );

    ctx.framework.actions.register("registerDeveloper", async (...args: unknown[]) =>
      runWrite(
        () => wallet.registerDeveloper(String(args[0] ?? ""), String(args[1] ?? "")),
        "registered",
      ),
    );

    ctx.framework.actions.register("withdrawTips", async (...args: unknown[]) =>
      runWrite(() => wallet.withdrawTips(Number(args[0])), "tipsWithdrawn"),
    );

    ctx.framework.actions.register("withdrawCredit", async () =>
      runWrite(() => wallet.withdrawCredit(), "creditWithdrawn"),
    );

    ctx.framework.actions.register("recoverTip", async () => {
      if (isConnecting.get()) {
        ctx.framework.notify.info("operationBusy");
        return false;
      }
      const result = await ctx.framework.notify.guardResult(
        () => wallet.recoverPendingOperation(),
      );
      if (!result.ok) return false;
      if (["confirmed", "credit", "fault"].includes(result.value)) {
        await refreshAfterWrite();
      } else if (result.value !== "none") {
        ctx.framework.notify.info("receiptPending");
      }
      return result.value;
    });

    ctx.framework.actions.register("refresh", async () => {
      const result = await ctx.framework.notify.guardResult(refresh);
      return result.ok;
    });

    const stopWalletSync = ctx.framework.wallet.onAccountChanged(() => {
      refreshGeneration += 1;
      clearWalletSnapshot();
      wallet.clearRecoveryView();
      void refresh().catch(() => undefined);
    });

    return {
      state: refsToObservables({
        developers: stats.developers,
        recentTips: stats.recentTips,
        totalDonated: stats.totalDonated,
        isLoading: wallet.isLoading,
        isRegistering: wallet.isRegistering,
        isWithdrawing: wallet.isWithdrawing,
        isRecovering: wallet.isRecovering,
        address: wallet.address,
        developerCount,
        totalDonatedDisplay,
        statsSettled,
        recentTipCount,
        myDeveloperId,
        myClaimableBalance,
        myClaimableBalanceDisplay,
        hasClaimableBalance,
        myCredit,
        myCreditDisplay,
        hasCredit,
        gasBalanceDisplay,
        walletReadStatus,
        walletReadError,
        registryStatus: stats.registryStatus,
        activityStatus: stats.activityStatus,
        readError: stats.readError,
        runtimeStatus: wallet.runtimeStatus,
        runtimeCompatible: wallet.runtimeCompatible,
        activeNetwork: wallet.activeNetwork,
        runtimeChecksum: wallet.runtimeChecksum,
        runtimeError: wallet.runtimeError,
        pendingOperation: wallet.pendingOperation,
        pendingTip: wallet.pendingOperation,
        lastReceipt: wallet.lastReceipt,
        actionNotice: wallet.actionNotice,
        recoveryStorageHealthy: wallet.recoveryStorageHealthy,
        isConnecting,
      }),
      loadData: async () => {
        await refresh();
      },
      cleanup: stopWalletSync,
    };
  },
});
