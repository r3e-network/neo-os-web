/**
 * milestone-escrow — Entry Point (New Pattern)
 *
 * Wires the useMilestoneEscrow composable to the platform via defineMiniApp.
 * The composable handles all domain logic; the platform renders stats,
 * sidebar, and shell chrome from manifest.ts configuration.
 */

import { defineMiniApp } from "@shared/utils/defineMiniApp";
import { registerActions } from "@shared/utils/createActionHandlers";
import { PlatformServices } from "@shared/services";
import PlayArea from "./PlayArea.vue";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import { useMilestoneEscrow } from "./composables/useMilestoneEscrow";

defineMiniApp({
  appId: "miniapp-milestone-escrow",
  playArea: PlayArea,
  manifest,
  messages,

  setup(ctx) {
    const platformServices = PlatformServices.create("miniapp-milestone-escrow", {
      t: ctx.t as (key: string) => string,
    });

    const escrow = useMilestoneEscrow({
      chain: platformServices.chain,
      eventBus: platformServices.events,
      t: ctx.t,
    });

    // ── Register actions for PlayArea dispatch ────────────────────────
    registerActions(ctx, {
      refreshEscrows: {
        handler: () => escrow.refreshEscrows(),
        errorKey: "error",
      },
      connectWallet: {
        handler: () => escrow.connectWallet(),
        successKey: "walletConnected",
        errorKey: "walletNotConnected",
      },
      createEscrow: {
        handler: (data: unknown) => escrow.createEscrow(data as Parameters<typeof escrow.createEscrow>[0]),
        successKey: "escrowCreated",
        errorKey: "error",
      },
      approveMilestone: {
        handler: (escrowItem: unknown) => escrow.approveMilestone(escrowItem as Parameters<typeof escrow.approveMilestone>[0]),
        successKey: "milestoneApproved",
        errorKey: "error",
      },
      claimMilestone: {
        handler: (escrowItem: unknown) => escrow.claimMilestone(escrowItem as Parameters<typeof escrow.claimMilestone>[0]),
        successKey: "claimSuccess",
        errorKey: "error",
      },
      cancelEscrow: {
        handler: (escrowItem: unknown) => escrow.cancelEscrow(escrowItem as Parameters<typeof escrow.cancelEscrow>[0]),
        successKey: "escrowCancelled",
        errorKey: "error",
      },
    });

    return {
      // ── State bindings ────────────────────────────────────────────
      // Keys match the `valueKey` fields in manifest.ts for stats/sidebar.
      state: {
        address: platformServices.chain.address,
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
        platformServices.destroy();
      },
    };
  },
});
