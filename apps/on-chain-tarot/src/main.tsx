/**
 * On-Chain Tarot — React Entry Point
 */

import { createObservable } from "@shared/react";
import { defineMiniApp } from "@shared/react/defineMiniApp";
import PhaserPlayArea from "./PhaserPlayArea";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import { useTarot } from "./composables/useTarot";
import { createTarotGuestEngine } from "./logic/guest-engine";

defineMiniApp({
  appId: "miniapp-onchaintarot",
  playArea: PhaserPlayArea,
  manifest,
  messages,

  setup(ctx) {
    const app = ctx.framework;

    const tarot = useTarot({
      app,
      clipboard: ctx.services.clipboard,
      t: ctx.t,
    });

    tarot.setAddress(app.chain.address.get() ?? null);

    // ── Play mode (guest | gamefi) ────────────────────────────────────────────
    // Surfaced to the PlayArea (+ scene copy) so the GAS-at-stake / draw-fee
    // framing can be reframed for guest (free local reading). Kept in sync with
    // the launcher-selected app.mode; defaults to "gamefi" so gamefi is unchanged.
    const mode = createObservable(app.mode.get());

    // ── Guest (free / local) engine ───────────────────────────────────────────
    // Guest mode reuses the SAME observables + dispatch actions the scene reads,
    // driven by a purely local crypto-RNG tarot draw — no chain/oracle/reward
    // calls, so the framework guest guard never fires.
    const guest = createTarotGuestEngine({
      drawn: tarot.drawn,
      readingMode: tarot.readingMode,
      readingsCount: tarot.readingsCount,
      prepaidCredit: tarot.prepaidCredit,
      isLoading: tarot.isLoading,
      question: tarot.question,
      guestLeaderboard: app.mode.guestLeaderboard,
      storage: app.storage.local,
      t: ctx.t,
      setStatus: ctx.setStatus,
    });
    // Track mode changes for the UI and, on switching to guest, reset to a clean
    // local reading (replacing the on-chain reads done on mount).
    app.mode.onChange((next) => {
      mode.set(next);
      if (next === "guest") void guest.enter();
    });

    // Success/error toasts come from the framework action wrapper (successKey
    // + automatic error notification) — no hand-rolled notify.guard.
    app.actions.register(
      "draw",
      async () => {
        if (app.mode.isGuest()) {
          await guest.draw();
          return;
        }
        return tarot.draw();
      },
      { successKey: "cardsDrawn" },
    );

    // reset / flipCard / setQuestion / copyReading are pure client-side (no chain,
    // oracle, or reward call in either mode), so they work as-is in guest without
    // branching — they never touch a guarded surface.
    app.actions.register("reset", async () => {
      tarot.reset();
    });

    app.actions.register("flipCard", async (index: unknown) => {
      tarot.flipCard(Number(index));
    });

    app.actions.register("setQuestion", async (value: unknown) => {
      tarot.question.set(String(value ?? "").slice(0, 200));
    });

    app.actions.register("copyReading", async () => {
      await tarot.copyReading();
    });

    app.actions.register("refreshReadingState", async () => {
      if (app.mode.isGuest()) {
        await guest.refresh();
        return;
      }
      await tarot.loadAll();
    });

    // Error toasts come from the framework action wrapper. The success toast
    // is emitted manually via app.notify.success because it is conditional
    // (only when amount > 0) and parameterized — the action successKey path
    // fires unconditionally, so it cannot express the amount-gated toast.
    app.actions.register("withdrawCredit", async () => {
      if (app.mode.isGuest()) {
        guest.withdrawCredit();
        return;
      }
      const { amount } = await tarot.withdrawCredit();
      if (amount > 0) {
        app.notify.success("creditWithdrawn", {
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
        mode,
      },
      loadData: async () => {
        // Guest is a purely local reading — never touch the chain on load, and
        // never let a mount-time gamefi read clobber the guest surface.
        if (app.mode.isGuest()) {
          await guest.enter();
          return;
        }
        await tarot.loadAll();
      },
    };
  },
});
