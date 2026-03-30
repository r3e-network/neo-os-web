/**
 * Self-Loan — Entry Point (OS Services Pattern)
 *
 * This miniapp uses OS service proxies (ctx.os.payment, ctx.os.escrow,
 * ctx.os.storage, ctx.os.badge) instead of direct chain calls. The proxies
 * handle all contract interaction through edge functions, so the miniapp
 * never touches contract hashes, parameter encoding, or event parsing.
 *
 * Architecture:
 *   main.ts -> defineMiniApp({ playArea, manifest, setup })
 *   setup() -> useSelfLoan({ paymentService, escrowService, storageService, badgeService, t })
 *
 * The composable calls:
 *   ctx.os.payment.getBalance()          — load NEO balance
 *   ctx.os.payment.deposit(amount, memo) — deposit NEO collateral
 *   ctx.os.escrow.create(params)         — create loan escrow
 *   ctx.os.escrow.get(escrowId)          — load loan position
 *   ctx.os.storage.get("platform-stats") — load platform config
 *   ctx.os.storage.list("loan:")         — load loan history
 *   ctx.os.badge.award(badgeId, user)    — award achievements
 *
 * Everything else (manifest, PlayArea, i18n, actions) stays the same.
 */

import { defineMiniApp } from "@shared/utils/defineMiniApp";
import { registerActions } from "@shared/utils/createActionHandlers";
import PlayArea from "./PlayArea.vue";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import { useSelfLoan } from "./composables/useSelfLoan";

defineMiniApp({
  appId: "miniapp-self-loan",
  playArea: PlayArea,
  manifest,
  messages,

  /**
   * Setup function — wires OS payment, escrow, storage, and badge
   * services to reactive state.
   *
   * Called once when the miniapp mounts. Uses ctx.os.* (OS service
   * proxies) for all data loading and mutations instead of
   * ctx.services.chain directly.
   */
  setup(ctx) {
    const loan = useSelfLoan({
      paymentService: ctx.os.payment,
      escrowService: ctx.os.escrow,
      storageService: ctx.os.storage,
      badgeService: ctx.os.badge,
      t: ctx.t as (
        key: string,
        params?: Record<string, string | number>,
      ) => string,
    });

    // Track wallet connection state via the platform's chain service
    loan.isConnected.value = Boolean(ctx.services.chain.address.value);

    // Register actions so they can be called from operation panels or
    // from the PlayArea via the injected action registry.
    registerActions(ctx, {
      connectWallet: {
        handler: async () => {
          await ctx.services.chain.ensureWallet();
          loan.isConnected.value = Boolean(ctx.services.chain.address.value);
          await loan.loadAll();
        },
      },
      takeLoan: {
        handler: loan.takeLoan,
        successKey: "loanApproved",
      },
    });

    return {
      // ── State bindings ────────────────────────────────────────────
      // Keys must match the `valueKey` fields in manifest.ts.
      // The platform reads these to render stats grid, sidebar, etc.
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

      // ── Lifecycle ─────────────────────────────────────────────────
      // Called by the platform on mount and when the wallet reconnects.
      loadData: loan.loadAll,
    };
  },
});
