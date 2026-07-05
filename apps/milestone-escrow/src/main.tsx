/**
 * milestone-escrow — Entry Point (React)
 */

import { defineMiniApp, createObservable, refsToObservables } from "@shared/react";
import PlayArea from "./PlayArea";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import { useMilestoneEscrow } from "./composables/useMilestoneEscrow";

defineMiniApp({
  appId: "miniapp-milestone-escrow",
  playArea: PlayArea,
  manifest,
  messages,

  setup(ctx) {
    const escrow = useMilestoneEscrow({
      app: ctx.framework,
      chain: ctx.services.chain,
      t: ctx.t,
    });

    escrow.setAddress(ctx.services.chain.address.get() ?? "");

    // Every action runs through notify.guard so a failing handler surfaces an
    // error toast instead of an unhandled rejection — critical for the
    // deposit-then-create flow, where "depositPrepaidNoEscrow" fires AFTER the
    // user's funds already moved and must never be silently swallowed.
    ctx.framework.actions.register("refreshEscrows", async () => {
      await ctx.services.notify.guard(() => escrow.refreshEscrows());
    });

    ctx.framework.actions.register("connectWallet", async () => {
      await ctx.services.notify.guard(async () => {
        await ctx.services.chain.ensureWallet();
        escrow.setAddress(ctx.services.chain.address.get() ?? "");
        await escrow.connectWallet();
      });
    });

    ctx.framework.actions.register("createEscrow", async (data: unknown) => {
      // Surface the guard result so PlayArea keeps its post-success form reset
      // behind an actual success (guard swallows failures into error toasts).
      const result = await ctx.services.notify.guard(async () => {
        await escrow.createEscrow(
          data as Parameters<typeof escrow.createEscrow>[0],
        );
        return true;
      }, "escrowCreated");
      return result === true;
    });

    ctx.framework.actions.register("approveMilestone", async (escrowItem: unknown) => {
      await ctx.services.notify.guard(
        () =>
          escrow.approveMilestone(
            escrowItem as Parameters<typeof escrow.approveMilestone>[0],
          ),
        "approveSuccess",
      );
    });

    ctx.framework.actions.register("claimMilestone", async (escrowItem: unknown) => {
      await ctx.services.notify.guard(
        () =>
          escrow.claimMilestone(
            escrowItem as Parameters<typeof escrow.claimMilestone>[0],
          ),
        "claimSuccess",
      );
    });

    ctx.framework.actions.register("cancelEscrow", async (escrowItem: unknown) => {
      await ctx.services.notify.guard(
        () =>
          escrow.cancelEscrow(
            escrowItem as Parameters<typeof escrow.cancelEscrow>[0],
          ),
        "cancelSuccess",
      );
    });

    return {
      state: refsToObservables({
        address: ctx.services.chain.address,
        contractReady: escrow.contractReady,
        creatorEscrowCount: escrow.creatorEscrowCount,
        beneficiaryEscrowCount: escrow.beneficiaryEscrowCount,
        activeCount: escrow.activeCount,
        completedCount: escrow.completedCount,
        creatorEscrows: escrow.creatorEscrows,
        beneficiaryEscrows: escrow.beneficiaryEscrows,
        isRefreshing: escrow.isRefreshing,
        isCreating: escrow.isCreating,
        approvingId: escrow.approvingId,
        claimingId: escrow.claimingId,
        cancellingId: escrow.cancellingId,
        statusLabelFunc: createObservable(escrow.statusLabel),
        formatAmountFunc: createObservable(escrow.formatAmount),
        formatAddressFunc: createObservable(escrow.formatAddress),
      }),
      
      loadData: escrow.loadAll,
      cleanup: () => { escrow.cleanup(); },
    };
  },
});
