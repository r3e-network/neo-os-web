/**
 * Breakup Contract — Entry Point (React)
 */

import { defineMiniApp, refsToObservables } from "@shared/react";
import PlayArea from "./PlayArea";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import { useBreakup } from "./composables/useBreakup";

defineMiniApp({
  appId: "miniapp-breakupcontract",
  playArea: PlayArea,
  manifest,
  messages,

  setup(ctx) {
    const breakup = useBreakup({
      escrowService: ctx.os.escrow,
      storageService: ctx.os.storage,
      badgeService: ctx.os.badge,
      eventBus: ctx.services.events,
      t: ctx.t,
    });

    ctx.registerAction("createContract", async (...args: unknown[]) => {
      const form = (args[0] ?? {}) as {
        partnerAddress?: string;
        stakeAmount?: string;
        duration?: string;
        title?: string;
        terms?: string;
      };
      breakup.partnerAddress.set(String(form.partnerAddress ?? ""));
      breakup.stakeAmount.set(String(form.stakeAmount ?? ""));
      breakup.duration.set(String(form.duration ?? ""));
      breakup.contractTitle.set(String(form.title ?? ""));
      breakup.contractTerms.set(String(form.terms ?? ""));
      await ctx.services.notify.guard(
        () => breakup.createContract(),
        "contractCreated",
      );
    });
    ctx.registerAction("signContract", (contract: unknown) =>
      ctx.services.notify.guard(
        () => breakup.signContract(contract as { id: number; stake: number }),
        "contractSigned",
      ),
    );
    ctx.registerAction("breakContract", (contract: unknown) =>
      ctx.services.notify.guard(
        () => breakup.breakContract(contract as { id: number }),
        "contractBroken",
      ),
    );

    return {
      state: refsToObservables({
        contracts: breakup.contracts,
        address: breakup.address,
        contractCount: breakup.contractCount,
        activeCount: breakup.activeCount,
        pendingCount: breakup.pendingCount,
        brokenCount: breakup.brokenCount,
        isLoading: breakup.isLoading,
      }),
      loadData: breakup.loadContracts,
    };
  },
});
