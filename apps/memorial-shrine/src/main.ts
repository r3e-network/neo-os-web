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
      try {
        await shrine.createMemorial(form);
        ctx.setStatus(ctx.t("createSuccess"), "success");
      } catch (e) {
        ctx.setStatus(e instanceof Error ? e.message : ctx.t("error"), "error");
      }
    });

    ctx.registerAction("payTribute", async (
      memorialId: number,
      offeringType: number,
      offeringCost: number,
      message: string,
    ) => {
      try {
        await shrine.payTribute(memorialId, offeringType, offeringCost, message);
        ctx.setStatus(ctx.t("tributeSuccess"), "success");
      } catch (e) {
        ctx.setStatus(e instanceof Error ? e.message : ctx.t("error"), "error");
      }
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
