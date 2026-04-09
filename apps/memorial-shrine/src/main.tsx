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
      nftService: ctx.os.nft,
      storageService: ctx.os.storage,
      badgeService: ctx.os.badge,
      eventBus: ctx.services.events,
      t: ctx.t,
    });

    ctx.registerAction("openMemorial", async (id: number) => { shrine.openMemorial(id); });
    ctx.registerAction("createMemorial", async (form: {
      name: string; photoHash: string; relationship: string;
      birthYear: number; deathYear: number; biography: string; obituary: string;
    }) => {
      await ctx.services.notify.guard(() => shrine.createMemorial(form), "createSuccess");
    });
    ctx.registerAction("payTribute", async (
      memorialId: number, offeringType: number, offeringCost: number, message: string,
    ) => {
      await ctx.services.notify.guard(
        () => shrine.payTribute(memorialId, offeringType, offeringCost, message),
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
      }),
      loadData: shrine.loadAll,
      cleanup: () => { shrine.cleanupTimers(); },
    };
  },
});
