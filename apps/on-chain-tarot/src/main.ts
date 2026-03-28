import { defineMiniApp } from "@shared/utils/defineMiniApp";
import { PlatformServices } from "@shared/services";
import PlayArea from "./PlayArea.vue";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import { useTarot } from "./composables/useTarot";

defineMiniApp({
  appId: "miniapp-onchaintarot",
  playArea: PlayArea,
  manifest,
  messages,

  setup(ctx) {
    const platformServices = PlatformServices.create("miniapp-onchaintarot", {
      t: ctx.t as (key: string) => string,
    });

    const tarot = useTarot({
      chain: platformServices.chain,
      oracle: platformServices.oracle,
      eventBus: platformServices.events,
      t: ctx.t,
    });

    ctx.registerAction("draw", async (question: string) => {
      try { await tarot.draw(question); ctx.setStatus(ctx.t("cardsDrawn"), "success"); }
      catch (e) { ctx.setStatus(e instanceof Error ? e.message : ctx.t("error"), "error"); }
    });

    ctx.registerAction("reset", async () => { tarot.reset(); });
    ctx.registerAction("flipCard", async (index: number) => { tarot.flipCard(index); });

    return {
      state: {
        readingsCount: tarot.readingsCount,
        drawn: tarot.drawn,
        drawnCount: tarot.drawnCount,
        hasDrawn: tarot.hasDrawn,
        allFlipped: tarot.allFlipped,
        allRevealedDisplay: tarot.allRevealedDisplay,
        isLoading: tarot.isLoading,
        reading: tarot.reading,
        question: tarot.question,
      },
      loadData: tarot.loadReadingCount,
      cleanup: () => { platformServices.destroy(); },
    };
  },
});
