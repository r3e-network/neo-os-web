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
      escrowService: ctx.os.escrow,
      paymentService: ctx.os.payment,
      t: ctx.t,
    });

    escrow.setAddress(ctx.services.chain.address.get() ?? "");

    ctx.registerAction("refreshEscrows", async () => {
      await escrow.refreshEscrows();
    });

    ctx.registerAction("connectWallet", async () => {
      await ctx.services.chain.ensureWallet();
      escrow.setAddress(ctx.services.chain.address.get() ?? "");
      await escrow.connectWallet();
    });

    ctx.registerAction("createEscrow", async (data: unknown) => {
      await escrow.createEscrow(
        data as Parameters<typeof escrow.createEscrow>[0],
      );
    });

    ctx.registerAction("approveMilestone", async (escrowItem: unknown) => {
      await escrow.approveMilestone(
        escrowItem as Parameters<typeof escrow.approveMilestone>[0],
      );
    });

    ctx.registerAction("claimMilestone", async (escrowItem: unknown) => {
      await escrow.claimMilestone(
        escrowItem as Parameters<typeof escrow.claimMilestone>[0],
      );
    });

    ctx.registerAction("cancelEscrow", async (escrowItem: unknown) => {
      await escrow.cancelEscrow(
        escrowItem as Parameters<typeof escrow.cancelEscrow>[0],
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
