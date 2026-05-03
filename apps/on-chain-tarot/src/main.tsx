/**
 * On-Chain Tarot — React Entry Point
 */

import { defineMiniApp } from "@shared/react/defineMiniApp";
import PlayArea from "./PlayArea";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import { useTarot } from "./composables/useTarot";

defineMiniApp({
  appId: "miniapp-onchaintarot",
  playArea: PlayArea,
  manifest,
  messages,

  setup(ctx) {
    const tarot = useTarot({
      gameService: ctx.os.game,
      storageService: ctx.os.storage,
      badgeService: ctx.os.badge,
      t: ctx.t,
    });

    ctx.registerAction("draw", async () => {
      await ctx.services.notify.guard(() => tarot.draw(), "cardsDrawn");
    });

    ctx.registerAction("reset", async () => {
      tarot.reset();
    });

    ctx.registerAction("flipCard", async (index: unknown) => {
      tarot.flipCard(Number(index));
    });

    ctx.registerAction("setQuestion", async (value: unknown) => {
      tarot.question.set(String(value ?? "").slice(0, 200));
    });

    return {
      state: {
        drawn: tarot.drawn,
        isLoading: tarot.isLoading,
        hasDrawn: tarot.hasDrawn,
        allFlipped: tarot.allFlipped,
        allRevealedDisplay: tarot.allRevealedDisplay,
        readingsCount: tarot.readingsCount,
        cardsDrawnCount: tarot.cardsDrawnCount,
        question: tarot.question,
        readingMode: tarot.readingMode,
      },
      loadData: tarot.loadAll,
    };
  },
});
