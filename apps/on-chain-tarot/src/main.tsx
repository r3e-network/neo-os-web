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
      app: ctx.framework,
      cache: ctx.services.cache,
      clipboard: ctx.services.clipboard,
      t: ctx.t,
    });

    tarot.setAddress(ctx.services.chain.address.get() ?? null);

    ctx.framework.actions.register("draw", async () => {
      await ctx.services.notify.guard(() => tarot.draw(), "cardsDrawn");
    });

    ctx.framework.actions.register("reset", async () => {
      tarot.reset();
    });

    ctx.framework.actions.register("flipCard", async (index: unknown) => {
      tarot.flipCard(Number(index));
    });

    ctx.framework.actions.register("setQuestion", async (value: unknown) => {
      tarot.question.set(String(value ?? "").slice(0, 200));
    });

    ctx.framework.actions.register("copyReading", async () => {
      await tarot.copyReading();
    });

    ctx.framework.actions.register("withdrawCredit", async () => {
      await ctx.services.notify.guard(async () => {
        const { amount } = await tarot.withdrawCredit();
        if (amount > 0) {
          ctx.services.notify.success("creditWithdrawn", {
            amount: Number(amount.toFixed(4)),
            tokenGas: ctx.t("tokenGas"),
          });
        }
      });
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
        prepaidCredit: tarot.prepaidCredit,
      },
      loadData: tarot.loadAll,
    };
  },
});
