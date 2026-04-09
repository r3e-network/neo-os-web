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
      lendingService: ctx.os.lending,
      paymentService: ctx.os.payment,
      storageService: ctx.os.storage,
      oracleService: ctx.services.oracle,
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

    ctx.registerAction("setBorrowAmount", async (amount: unknown) => {
      if (typeof amount === "string") loan.borrowAmount.set(amount);
    });

    ctx.registerAction("setCollateralAmount", async (amount: unknown) => {
      if (typeof amount === "string") loan.collateralAmount.set(amount);
    });

    return {
      state: {
        loan: loan.loan,
        neoBalance: loan.neoBalance,
        neoPrice: loan.neoPrice,
        stats: loan.stats,
        platformStats: loan.platformStats,
        borrowAmount: loan.borrowAmount,
        collateralAmount: loan.collateralAmount,
        selectedLtv: loan.selectedLtv,
        isLoading: loan.isLoading,
        isBorrowing: loan.isBorrowing,
        isRepaying: loan.isRepaying,
        isConnected: loan.isConnected,
        selectedLtvPercent: loan.selectedLtvPercent,
        healthFactor: loan.healthFactor,
        currentLTV: loan.currentLTV,
        collateralDisplay: loan.collateralDisplay,
        borrowedDisplay: loan.borrowedDisplay,
        healthFactorDisplay: loan.healthFactorDisplay,
        currentLTVDisplay: loan.currentLTVDisplay,
        hasLoanDisplay: loan.hasLoanDisplay,
        neoBalanceDisplay: loan.neoBalanceDisplay,
        totalLoans: loan.totalLoans,
        totalBorrowedDisplay: loan.totalBorrowedDisplay,
        totalRepaidDisplay: loan.totalRepaidDisplay,
        healthColor: loan.healthColor,
        healthArc: loan.healthArc,
      },
      loadData: loan.loadAll,
    };
  },
});
