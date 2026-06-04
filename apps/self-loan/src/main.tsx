/**
 * Self-Loan — React Entry Point
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
      paymentService: ctx.os.payment,
      escrowService: ctx.os.escrow,
      storageService: ctx.os.storage,
      badgeService: ctx.os.badge,
      t: ctx.t,
    });

    ctx.registerAction("borrow", async (formData: unknown) => {
      await ctx.services.notify.guard(
        () => loan.borrow(formData as Record<string, unknown>),
        "borrowSuccess",
      );
    });

    ctx.registerAction("repay", async (amount: unknown) => {
      await ctx.services.notify.guard(
        () => loan.repay(String(amount)),
        "repaySuccess",
      );
    });

    ctx.registerAction("addCollateral", async (amount: unknown) => {
      await ctx.services.notify.guard(
        () => loan.addCollateral(String(amount)),
        "collateralAdded",
      );
    });

    ctx.registerAction("setCollateralAmount", async (amount: unknown) => {
      if (typeof amount === "string") loan.collateralAmount.set(amount);
    });

    ctx.registerAction("setLtvTier", async (tier: unknown) => {
      const next = Number(tier);
      if (Number.isInteger(next) && next >= 1 && next <= 3) {
        loan.selectedTier.set(next);
      }
    });

    return {
      state: {
        loan: loan.loan,
        loanHistory: loan.loanHistory,
        neoBalance: loan.neoBalance,
        neoPrice: loan.neoPrice,
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
        profitAnchorValue: loan.profitAnchorValue,
      },
      loadData: loan.loadAll,
    };
  },
});
