import { defineMiniApp } from "@shared/utils/defineMiniApp";
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
    const platformServices = ctx.services;

    const tarot = useTarot({
      chain: platformServices.chain,
      eventBus: platformServices.events,
      t: ctx.t,
    });

    ctx.registerAction("draw", () =>
      platformServices.notify.guard(() => tarot.draw(), "cardsDrawn"),
    );

    ctx.registerAction("reset", async () => {
      tarot.reset();
    });
    ctx.registerAction("flipCard", async (index?: unknown) => {
      tarot.flipCard(Number(index ?? 0));
    });

    return {
      state: {
        readingsCount: tarot.readingsCount,
        drawn: tarot.drawn,
        hasDrawn: tarot.hasDrawn,
        allFlipped: tarot.allFlipped,
        isLoading: tarot.isLoading,
        question: tarot.question,
      },
      loadData: tarot.loadAll,
    };
  },
});
