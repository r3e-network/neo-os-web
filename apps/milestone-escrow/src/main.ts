/**
 * milestone-escrow — Entry Point (OS Services Pattern)
 *
 * This miniapp uses OS service proxies (ctx.os.escrow, ctx.os.payment)
 * instead of direct chain calls. The EscrowProxy was designed to replace
 * this exact app's pattern — milestone creation, approval, claiming, and
 * cancellation map directly to EscrowProxy methods.
 *
 * Architecture:
 *   main.ts -> defineMiniApp({ playArea, manifest, setup })
 *   setup() -> useMilestoneEscrow({ escrowService, paymentService, t })
 *
 * The composable calls:
 *   ctx.os.escrow.create(params)                       — create escrow
 *   ctx.os.escrow.completeMilestone(escrowId, index)   — approve milestone
 *   ctx.os.escrow.fund(escrowId)                       — claim milestone
 *   ctx.os.escrow.refund(escrowId)                     — cancel escrow
 *   ctx.os.escrow.get(escrowId)                        — get details
 *   ctx.os.payment.deposit(amount, memo)               — fund escrow
 *
 * Everything else (manifest, PlayArea, i18n, actions) stays the same.
 */

import { defineMiniApp } from "@shared/utils/defineMiniApp";
import { registerActions } from "@shared/utils/createActionHandlers";
import PlayArea from "./PlayArea.vue";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import { useMilestoneEscrow } from "./composables/useMilestoneEscrow";

defineMiniApp({
  appId: "miniapp-milestone-escrow",
  playArea: PlayArea,
  manifest,
  messages,

  /**
   * Setup function — wires OS escrow and payment services to reactive state.
   *
   * Called once when the miniapp mounts. Uses ctx.os.escrow and
   * ctx.os.payment (OS service proxies) for all data loading and
   * mutations instead of ctx.services.chain directly.
   */
  setup(ctx) {
    const escrow = useMilestoneEscrow({
      escrowService: ctx.os.escrow,
      paymentService: ctx.os.payment,
      t: ctx.t,
    });

    // Track wallet address from the platform's chain service
    escrow.setAddress(ctx.services.chain.address.value ?? "");

    // ── Register actions for PlayArea dispatch ────────────────────────
    registerActions(ctx, {
      refreshEscrows: {
        handler: () => escrow.refreshEscrows(),
        errorKey: "error",
      },
      connectWallet: {
        handler: async () => {
          await ctx.services.chain.ensureWallet();
          escrow.setAddress(ctx.services.chain.address.value ?? "");
          await escrow.connectWallet();
        },
        successKey: "walletConnected",
        errorKey: "walletNotConnected",
      },
      createEscrow: {
        handler: (data: unknown) =>
          escrow.createEscrow(
            data as Parameters<typeof escrow.createEscrow>[0],
          ),
        successKey: "escrowCreated",
        errorKey: "error",
      },
      approveMilestone: {
        handler: (escrowItem: unknown) =>
          escrow.approveMilestone(
            escrowItem as Parameters<typeof escrow.approveMilestone>[0],
          ),
        successKey: "milestoneApproved",
        errorKey: "error",
      },
      claimMilestone: {
        handler: (escrowItem: unknown) =>
          escrow.claimMilestone(
            escrowItem as Parameters<typeof escrow.claimMilestone>[0],
          ),
        successKey: "claimSuccess",
        errorKey: "error",
      },
      cancelEscrow: {
        handler: (escrowItem: unknown) =>
          escrow.cancelEscrow(
            escrowItem as Parameters<typeof escrow.cancelEscrow>[0],
          ),
        successKey: "escrowCancelled",
        errorKey: "error",
      },
    });

    return {
      // ── State bindings ────────────────────────────────────────────
      // Keys match the `valueKey` fields in manifest.ts for stats/sidebar.
      state: {
        address: ctx.services.chain.address,
        contractReady: escrow.contractReady,

        // Manifest stat/sidebar bindings
        creatorEscrowCount: escrow.creatorEscrowCount,
        beneficiaryEscrowCount: escrow.beneficiaryEscrowCount,
        activeCount: escrow.activeCount,
        completedCount: escrow.completedCount,

        // PlayArea reactive state
        creatorEscrows: escrow.creatorEscrows,
        beneficiaryEscrows: escrow.beneficiaryEscrows,
        isRefreshing: escrow.isRefreshing,
        isCreating: escrow.isCreating,
        approvingId: escrow.approvingId,
        claimingId: escrow.claimingId,
        cancellingId: escrow.cancellingId,

        // Display helper functions (wrapped as refs for PlayArea)
        statusLabelFunc: { value: escrow.statusLabel },
        formatAmountFunc: { value: escrow.formatAmount },
        formatAddressFunc: { value: escrow.formatAddress },
      },

      // ── Lifecycle ─────────────────────────────────────────────────
      loadData: escrow.loadAll,

      // ── Cleanup ───────────────────────────────────────────────────
      cleanup: () => {
        escrow.cleanup();
      },
    };
  },
});
