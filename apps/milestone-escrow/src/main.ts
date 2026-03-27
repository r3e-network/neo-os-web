/**
 * milestone-escrow — Entry Point (New Pattern)
 *
 * Wires the useMilestoneEscrow composable to the platform via defineMiniApp.
 * The composable handles all domain logic; the platform renders stats,
 * sidebar, and shell chrome from manifest.ts configuration.
 */

import { defineMiniApp } from "@shared/utils/defineMiniApp";
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
    ctx.registerAction("refreshEscrows", async () => {
      try {
        await escrow.refreshEscrows();
      } catch (e) {
        ctx.setStatus(e instanceof Error ? e.message : ctx.t("error"), "error");
      }
    });

    ctx.registerAction("connectWallet", async () => {
      try {
        await escrow.connectWallet();
        ctx.setStatus(ctx.t("walletConnected"), "success");
      } catch (e) {
        ctx.setStatus(e instanceof Error ? e.message : ctx.t("walletNotConnected"), "error");
      }
    });

    ctx.registerAction("createEscrow", async (data?: unknown) => {
      try {
        await escrow.createEscrow(data as Parameters<typeof escrow.createEscrow>[0]);
        ctx.setStatus(ctx.t("escrowCreated"), "success");
      } catch (e) {
        ctx.setStatus(e instanceof Error ? e.message : ctx.t("error"), "error");
      }
    });

    ctx.registerAction("approveMilestone", async (escrowItem?: unknown) => {
      try {
        await escrow.approveMilestone(escrowItem as Parameters<typeof escrow.approveMilestone>[0]);
        ctx.setStatus(ctx.t("milestoneApproved"), "success");
      } catch (e) {
        ctx.setStatus(e instanceof Error ? e.message : ctx.t("error"), "error");
      }
    });

    ctx.registerAction("claimMilestone", async (escrowItem?: unknown) => {
      try {
        await escrow.claimMilestone(escrowItem as Parameters<typeof escrow.claimMilestone>[0]);
        ctx.setStatus(ctx.t("claimSuccess"), "success");
      } catch (e) {
        ctx.setStatus(e instanceof Error ? e.message : ctx.t("error"), "error");
      }
    });

    ctx.registerAction("cancelEscrow", async (escrowItem?: unknown) => {
      try {
        await escrow.cancelEscrow(escrowItem as Parameters<typeof escrow.cancelEscrow>[0]);
        ctx.setStatus(ctx.t("escrowCancelled"), "success");
      } catch (e) {
        ctx.setStatus(e instanceof Error ? e.message : ctx.t("error"), "error");
      }
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
