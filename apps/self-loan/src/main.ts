/**
 * self-loan — Entry Point (New Pattern)
 *
 * Uses defineMiniApp() to wire manifest, PlayArea, and domain logic.
 */

import { defineMiniApp } from "@shared/utils/defineMiniApp";
import { PlatformServices } from "@shared/services";
import PlayArea from "./PlayArea.vue";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import { useSelfLoan } from "./composables/useSelfLoan";

defineMiniApp({
  appId: "miniapp-self-loan",
  playArea: PlayArea,
  manifest,
  messages,

  setup(ctx) {
    const platformServices = PlatformServices.create("miniapp-self-loan", {
      t: ctx.t as (key: string) => string,
    });

    const loan = useSelfLoan({
      t: ctx.t as (key: string, params?: Record<string, string | number>) => string,
    });

    // Register wallet connect action for PlayArea dispatch
    ctx.registerAction("connectWallet", async () => {
      try {
        await loan.connect();
        await loan.loadAll();
      } catch (e) {
        ctx.setStatus(e instanceof Error ? e.message : ctx.t("error"), "error");
      }
    });

    return {
      state: {
        // Wallet
        isConnected: loan.isConnected,

        // Position display values
        collateralDisplay: loan.collateralDisplay,
        borrowedDisplay: loan.borrowedDisplay,
        healthFactorDisplay: loan.healthFactorDisplay,
        currentLTVDisplay: loan.currentLTVDisplay,
        currentLTV: loan.currentLTV,

        // Health gauge computeds
        healthFactor: loan.healthFactor,
        healthColor: loan.healthColor,
        healthArc: loan.healthArc,

        // Sidebar values
        hasLoanDisplay: loan.hasLoanDisplay,
        neoBalanceDisplay: loan.neoBalanceDisplay,

        // Stats tab values
        totalLoans: loan.totalLoans,
        totalBorrowedDisplay: loan.totalBorrowedDisplay,
        totalRepaidDisplay: loan.totalRepaidDisplay,
      },

      loadData: loan.loadAll,

      cleanup: () => {
        platformServices.destroy();
      },
    };
  },
});
