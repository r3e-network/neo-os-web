/**
 * On-Chain Tarot — React Entry Point
 */

import { defineMiniApp } from "@shared/react/defineMiniApp";
import PhaserPlayArea from "./PhaserPlayArea";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import { useTarot } from "./composables/useTarot";

defineMiniApp({
  appId: "miniapp-onchaintarot",
  playArea: PhaserPlayArea,
  manifest,
  messages,

  setup(ctx) {
    const tarot = useTarot({
      app: ctx.framework,
      clipboard: ctx.services.clipboard,
      t: ctx.t,
    });

    tarot.setAddress(ctx.framework.chain.address.get() ?? null);

    // Success/error toasts come from the framework action wrapper (successKey
    // + automatic error notification) — no hand-rolled notify.guard.
    ctx.framework.actions.register("draw", () => tarot.draw(), {
      successKey: "cardsDrawn",
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

    ctx.framework.actions.register("refreshReadingState", async () => {
      await tarot.loadAll();
    });

    // Error toasts come from the framework action wrapper. The success toast
    // is emitted manually via app.notify.success because it is conditional
    // (only when amount > 0) and parameterized — the action successKey path
    // fires unconditionally, so it cannot express the amount-gated toast.
    ctx.framework.actions.register("withdrawCredit", async () => {
      const { amount } = await tarot.withdrawCredit();
      if (amount > 0) {
        ctx.framework.notify.success("creditWithdrawn", {
          amount: Number(amount.toFixed(4)),
          tokenGas: ctx.t("tokenGas"),
        });
      }
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
        walletAddress: tarot.address,
      },
      loadData: tarot.loadAll,
    };
  },
});
