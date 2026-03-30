/**
 * Flash Loan — Entry Point (OS Services Pattern)
 *
 * This miniapp uses OS service proxies (ctx.os.payment, ctx.os.storage,
 * ctx.os.badge) instead of direct chain calls. The proxies handle all
 * contract interaction through edge functions, so the miniapp never
 * touches contract hashes, parameter encoding, or event parsing.
 *
 * Architecture:
 *   main.ts -> defineMiniApp({ playArea, manifest, setup })
 *   setup() -> useFlashloanCore({ paymentService, storageService, badgeService, t })
 *
 * The composable calls:
 *   ctx.os.payment.getBalance()                — pool balance
 *   ctx.os.storage.get(`loan:${id}`)           — loan lookup
 *   ctx.os.storage.list("loan:")               — loan stats/history
 *   ctx.os.storage.set("loan:request", data)   — request loan
 *   ctx.os.badge.award(badgeId, user)          — achievement tracking
 *
 * Everything else (manifest, PlayArea, i18n, actions) stays the same.
 */

import { defineMiniApp } from "@shared/utils/defineMiniApp";
import PlayArea from "./PlayArea.vue";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import { useFlashloanCore } from "./composables/useFlashloanCore";

defineMiniApp({
  appId: "miniapp-flashloan",
  playArea: PlayArea,
  manifest,
  messages,

  /**
   * Setup function — wires OS services to reactive state.
   *
   * Called once when the miniapp mounts. Uses ctx.os (OS service proxies)
   * for all data loading and mutations instead of ctx.services.chain.
   */
  setup(ctx) {
    const { notify } = ctx.services;

    const flash = useFlashloanCore({
      paymentService: ctx.os.payment,
      storageService: ctx.os.storage,
      badgeService: ctx.os.badge,
      t: ctx.t as (
        key: string,
        params?: Record<string, string | number>,
      ) => string,
    });

    // Track wallet address from the platform's chain service
    flash.setAddress(ctx.services.chain.address.value ?? "");

    ctx.registerAction("lookupLoan", async (loanId: string) => {
      await notify.guard(() => flash.lookupLoan(loanId), "loanStatusLoaded");
    });

    ctx.registerAction(
      "requestLoan",
      async (data: {
        amount: string;
        callbackContract: string;
        callbackMethod: string;
      }) => {
        await notify.guard(() => flash.requestLoan(data), "loanRequested");
      },
    );

    ctx.registerAction("connect", async () => {
      await notify.guard(async () => {
        await ctx.services.chain.ensureWallet();
        flash.setAddress(ctx.services.chain.address.value ?? "");
      });
    });

    return {
      state: {
        // Stats grid values
        poolBalance: flash.poolBalance,
        totalLoans: flash.stats,
        totalVolume: flash.stats,
        totalFees: flash.stats,
        avgLoanSize: flash.stats,

        // Sidebar values
        recentLoansCount: flash.recentLoans,

        // PlayArea state
        loanDetails: flash.loanDetails,
        isLoading: flash.isLoading,
        validationError: flash.validationError,
        isConnected: flash.address,
        recentLoans: flash.recentLoans,
      },

      loadData: flash.loadData,
    };
  },
});
