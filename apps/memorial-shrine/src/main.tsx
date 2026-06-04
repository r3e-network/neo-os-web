/**
 * Memorial Shrine — Entry Point (React)
 */

import { defineMiniApp, refsToObservables } from "@shared/react";
import PlayArea from "./PlayArea";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import { useMemorialShrine } from "./composables/useMemorialShrine";

defineMiniApp({
  appId: "miniapp-memorial-shrine",
  playArea: PlayArea,
  manifest,
  messages,

  setup(ctx) {
    const shrine = useMemorialShrine({
      chainService: ctx.services.chain,
      launchNetwork: ctx.launchContext.network,
      storageService: ctx.os.storage,
      badgeService: ctx.os.badge,
      eventBus: ctx.services.events,
      t: ctx.t,
    });

    ctx.registerAction("openMemorial", async (...args: unknown[]) => {
      shrine.openMemorial(Number(args[0]));
    });
    ctx.registerAction("closeMemorial", async () => {
      shrine.closeMemorial();
    });
    ctx.registerAction("shareMemorial", async (...args: unknown[]) => {
      const id = Number(args[0]);
      const memorial = Number.isFinite(id)
        ? shrine.memorials.get().find((m) => m.id === id)
        : undefined;
      shrine.shareMemorial(memorial);
    });
    ctx.registerAction("createMemorial", async (...args: unknown[]) => {
      const form = args[0] as {
        name: string; photoHash: string; relationship: string;
        birthYear: number; deathYear: number; biography: string; obituary: string;
      };
      await ctx.services.notify.guard(() => shrine.createMemorial(form), "createSuccess");
    });
    ctx.registerAction("payTribute", async (...args: unknown[]) => {
      const [memorialId, offeringType, message, receiptId] = args;
      await ctx.services.notify.guard(
        () => shrine.payTribute(
          Number(memorialId),
          Number(offeringType),
          String(message ?? ""),
          receiptId == null ? undefined : String(receiptId),
        ),
        "tributeSuccess",
      );
    });

    return {
      state: refsToObservables({
        memorials: shrine.memorials,
        visitedMemorials: shrine.visitedMemorials,
        recentObituaries: shrine.recentObituaries,
        selectedMemorial: shrine.selectedMemorial,
        memorialCount: shrine.memorialCount,
        tributeCount: shrine.tributeCount,
        obituaryCount: shrine.obituaryCount,
        isSubmitting: shrine.isSubmitting,
        isPaying: shrine.isPaying,
        lastTx: shrine.lastTx,
      }),
      loadData: shrine.loadAll,
      cleanup: () => { shrine.cleanupTimers(); },
    };
  },
});
