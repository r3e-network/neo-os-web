/**
 * Self-Loan — React Entry Point
 *
 * Drives the standalone on-chain MiniAppSelfLoan contract directly via the
 * MiniApp framework SDK (ctx.framework — no OS service proxies, no raw
 * services). The composable owns all contract reads/writes; this file wires
 * the borrow / repay / addCollateral / reclaim actions through
 * app.notify.guard and re-loads data when the wallet connects or switches
 * (app.wallet.observe).
 *
 * ASSET CONVENTION (kept strictly separate end-to-end): COLLATERAL is NEO, an
 * integer token (collateral / NEO balance are WHOLE NEO, never ×1e8); DEBT is GAS
 * (borrowed / totals are displayed ÷1e8).
 */

import { defineMiniApp } from "@shared/react/defineMiniApp";
import PlayArea from "./PlayArea";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import { useSelfLoan, type ActionOutcome } from "./composables/useSelfLoan";
import { attestPlatformDeFiSelfLoanContract } from "./platform-defi-rpc";
import { attestSelfLoanContract } from "./self-loan-rpc";

defineMiniApp({
  appId: "miniapp-self-loan",
  playArea: PlayArea,
  manifest,
  messages,

  setup(ctx) {
    const loan = useSelfLoan({
      app: ctx.framework,
      t: ctx.t as (key: string, params?: Record<string, string | number>) => string,
      launchNetwork: ctx.launchContext.network,
      attestContract: attestSelfLoanContract,
      attestPlatformContract: attestPlatformDeFiSelfLoanContract,
    });

    loan.setAddress(ctx.framework.wallet.address() ?? "");

    // The wallet can connect or switch accounts after mount, so re-propagate the
    // address and reload the position / balance / credits whenever it changes.
    const stopAddressSync = ctx.framework.wallet.onAccountChanged(({ current }) => {
      loan.setAddress(current ?? "");
      void loan.loadAll();
    });

    const runWrite = async (
      work: () => Promise<ActionOutcome>,
      successKey: string,
    ): Promise<ActionOutcome | false> => {
      const outcome = await ctx.framework.notify.guardResult(work);
      if (!outcome.ok) return false;
      if (outcome.value === "confirmed") ctx.framework.notify.success(successKey);
      else ctx.framework.notify.info("pendingConfirmationLabel");
      return outcome.value;
    };

    ctx.framework.actions.register("borrow", async (formData: unknown) => {
      return runWrite(
        () => loan.borrow(formData as Record<string, unknown>),
        "borrowSuccess",
      );
    });

    ctx.framework.actions.register("repay", async (amount: unknown) => {
      return runWrite(
        () => loan.repay(String(amount)),
        "repaySuccess",
      );
    });

    ctx.framework.actions.register("addCollateral", async (amount: unknown) => {
      return runWrite(
        () => loan.addCollateral(String(amount)),
        "collateralAdded",
      );
    });

    ctx.framework.actions.register("reclaimCollateral", async () => {
      return runWrite(
        () => loan.reclaimCollateral(),
        "reclaimCollateralSuccess",
      );
    });

    ctx.framework.actions.register("reclaimRepayCredit", async () => {
      return runWrite(
        () => loan.reclaimRepayCredit(),
        "reclaimRepaySuccess",
      );
    });

    ctx.framework.actions.register("connectWallet", async () => {
      const outcome = await ctx.framework.notify.guardResult(async () => {
        const next = await ctx.framework.chain.ensureWallet();
        loan.setAddress(next);
        await loan.loadAll();
      });
      return outcome.ok;
    });

    ctx.framework.actions.register("refresh", async () => {
      await loan.loadAll();
      return true;
    });

    ctx.framework.actions.register("setCollateralAmount", async (amount: unknown) => {
      if (typeof amount === "string") loan.collateralAmount.set(amount);
    });

    ctx.framework.actions.register("setLtvTier", async (tier: unknown) => {
      const next = Number(tier);
      if (Number.isInteger(next) && next >= 1 && next <= 3) {
        loan.selectedTier.set(next);
      }
    });

    return {
      state: {
        loan: loan.loan,
        neoBalance: loan.neoBalance,
        gasBalance: loan.gasBalance,
        neoPrice: loan.neoPrice,
        neoPriceBase: loan.neoPriceBase,
        neoPriceDisplay: loan.neoPriceDisplay,
        poolGas: loan.poolGas,
        poolDisplay: loan.poolDisplay,
        hasActiveLoan: loan.hasActiveLoan,
        borrowOkNonce: loan.borrowOkNonce,
        repayOkNonce: loan.repayOkNonce,
        addCollateralOkNonce: loan.addCollateralOkNonce,
        isPriceNormalized: loan.isPriceNormalized,
        stats: loan.stats,
        platformStats: loan.platformStats,
        collateralAmount: loan.collateralAmount,
        selectedLtv: loan.selectedLtv,
        ltvOptions: loan.ltvOptions,
        isLoading: loan.isLoading,
        isBorrowing: loan.isBorrowing,
        isRepaying: loan.isRepaying,
        isAddingCollateral: loan.isAddingCollateral,
        isProcessing: loan.isProcessing,
        isRefreshing: loan.isRefreshing,
        isConnected: loan.isConnected,
        marketStatus: loan.marketStatus,
        balancesStatus: loan.balancesStatus,
        positionStatus: loan.positionStatus,
        recoveryStatus: loan.recoveryStatus,
        statsStatus: loan.statsStatus,
        marketReady: loan.marketReady,
        borrowDataReady: loan.borrowDataReady,
        manageDataReady: loan.manageDataReady,
        readError: loan.readError,
        lastRefreshAt: loan.lastRefreshAt,
        runtimeStatus: loan.runtimeStatus,
        runtimeCompatible: loan.runtimeCompatible,
        repayRecoveryAvailable: loan.repayRecoveryAvailable,
        activeNetwork: loan.activeNetwork,
        runtimeChecksum: loan.runtimeChecksum,
        selectedLtvPercent: loan.selectedLtvPercent,
        healthFactor: loan.healthFactor,
        coverageRatio: loan.coverageRatio,
        currentLTV: loan.currentLTV,
        collateralDisplay: loan.collateralDisplay,
        borrowedDisplay: loan.borrowedDisplay,
        healthFactorDisplay: loan.healthFactorDisplay,
        coverageRatioDisplay: loan.coverageRatioDisplay,
        currentLTVDisplay: loan.currentLTVDisplay,
        healthMetricLabel: loan.healthMetricLabel,
        hasLoanDisplay: loan.hasLoanDisplay,
        neoBalanceDisplay: loan.neoBalanceDisplay,
        gasBalanceDisplay: loan.gasBalanceDisplay,
        totalLoans: loan.totalLoans,
        totalBorrowedDisplay: loan.totalBorrowedDisplay,
        totalRepaidDisplay: loan.totalRepaidDisplay,
        custodyValue: loan.custodyValue,
        // Relayed-but-unconfirmed notice (chain.invoke verified=false)
        pendingConfirmation: loan.pendingConfirmation,
        hasPendingConfirmation: loan.hasPendingConfirmation,
        hasPendingOperation: loan.hasPendingOperation,
        journalReady: loan.journalReady,
        // Reclaim affordances (deposit-then-act recovery paths)
        collateralCredit: loan.collateralCredit,
        repayCredit: loan.repayCredit,
        hasCollateralCredit: loan.hasCollateralCredit,
        hasRepayCredit: loan.hasRepayCredit,
        collateralCreditDisplay: loan.collateralCreditDisplay,
        repayCreditDisplay: loan.repayCreditDisplay,
      },
      loadData: loan.loadAll,
      cleanup: () => {
        stopAddressSync();
        loan.dispose();
      },
    };
  },
});
