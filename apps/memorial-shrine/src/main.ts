import { defineMiniApp } from "@shared/utils/defineMiniApp";
import { PlatformServices } from "@shared/services";
import PlayArea from "./PlayArea.vue";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import { useMemorialShrine } from "./composables/useMemorialShrine";

defineMiniApp({
  appId: "miniapp-memorial-shrine",
  playArea: PlayArea,
  manifest,
  messages,

  setup(ctx) {
    const platformServices = PlatformServices.create("miniapp-memorial-shrine", {
      t: ctx.t as (key: string) => string,
    });

    const shrine = useMemorialShrine({
      chain: platformServices.chain,
      eventBus: platformServices.events,
      t: ctx.t,
    });

    const { notify } = platformServices;

    ctx.registerAction("openMemorial", async (id: number) => {
      shrine.openMemorial(id);
    });

    ctx.registerAction("createMemorial", async (form: {
      name: string;
      photoHash: string;
      relationship: string;
      birthYear: number;
      deathYear: number;
      biography: string;
      obituary: string;
    }) => {
      await notify.guard(() => shrine.createMemorial(form), "createSuccess");
    });

    ctx.registerAction("payTribute", async (
      memorialId: number,
      offeringType: number,
      offeringCost: number,
      message: string,
    ) => {
      await notify.guard(() => shrine.payTribute(memorialId, offeringType, offeringCost, message), "tributeSuccess");
    });

    return {
      state: {
        memorials: shrine.memorials,
        visitedMemorials: shrine.visitedMemorials,
        recentObituaries: shrine.recentObituaries,
        selectedMemorial: shrine.selectedMemorial,
        memorialCount: shrine.memorialCount,
        tributeCount: shrine.tributeCount,
        obituaryCount: shrine.obituaryCount,
        isSubmitting: shrine.isSubmitting,
        isPaying: shrine.isPaying,
      },
      loadData: shrine.loadAll,
      cleanup: () => { shrine.cleanupTimers(); platformServices.destroy(); },
    };
  },
});
