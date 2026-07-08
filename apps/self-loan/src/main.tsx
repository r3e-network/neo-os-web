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
import { useSelfLoan } from "./composables/useSelfLoan";

defineMiniApp({
  appId: "miniapp-self-loan",
  playArea: PlayArea,
  manifest,
  messages,

  setup(ctx) {
    const loan = useSelfLoan({
      app: ctx.framework,
      t: ctx.t as (key: string, params?: Record<string, string | number>) => string,
    });

    loan.setAddress(ctx.framework.wallet.address() ?? "");

    // The wallet can connect or switch accounts after mount, so re-propagate the
    // address and reload the position / balance / credits whenever it changes.
    const stopAddressSync = ctx.framework.wallet.observe().subscribe(() => {
      loan.setAddress(ctx.framework.wallet.address() ?? "");
      void loan.loadAll();
    });

    ctx.framework.actions.register("borrow", async (formData: unknown) => {
      await ctx.framework.notify.guard(
        () => loan.borrow(formData as Record<string, unknown>),
        { successKey: "borrowSuccess" },
      );
    });

    ctx.framework.actions.register("repay", async (amount: unknown) => {
      await ctx.framework.notify.guard(
        () => loan.repay(String(amount)),
        { successKey: "repaySuccess" },
      );
    });

    ctx.framework.actions.register("addCollateral", async (amount: unknown) => {
      await ctx.framework.notify.guard(
        () => loan.addCollateral(String(amount)),
        { successKey: "collateralAdded" },
      );
    });

    ctx.framework.actions.register("reclaimCollateral", async () => {
      await ctx.framework.notify.guard(
        () => loan.reclaimCollateral(),
        { successKey: "reclaimCollateralSuccess" },
      );
    });

    ctx.framework.actions.register("reclaimRepayCredit", async () => {
      await ctx.framework.notify.guard(
        () => loan.reclaimRepayCredit(),
        { successKey: "reclaimRepaySuccess" },
      );
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
        neoPrice: loan.neoPrice,
        neoPriceDisplay: loan.neoPriceDisplay,
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
        isConnected: loan.isConnected,
        selectedLtvPercent: loan.selectedLtvPercent,
        healthFactor: loan.healthFactor,
        currentLTV: loan.currentLTV,
        collateralDisplay: loan.collateralDisplay,
        borrowedDisplay: loan.borrowedDisplay,
        healthFactorDisplay: loan.healthFactorDisplay,
        currentLTVDisplay: loan.currentLTVDisplay,
        healthMetricLabel: loan.healthMetricLabel,
        hasLoanDisplay: loan.hasLoanDisplay,
        neoBalanceDisplay: loan.neoBalanceDisplay,
        totalLoans: loan.totalLoans,
        totalBorrowedDisplay: loan.totalBorrowedDisplay,
        totalRepaidDisplay: loan.totalRepaidDisplay,
        custodyValue: loan.custodyValue,
        // Relayed-but-unconfirmed notice (chain.invoke verified=false)
        pendingConfirmation: loan.pendingConfirmation,
        hasPendingConfirmation: loan.hasPendingConfirmation,
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
