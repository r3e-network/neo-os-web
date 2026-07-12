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

const INTENT_QUESTION_KEYS = {
  clarity: "questionPresetClarity",
  decision: "questionPresetDecision",
  momentum: "questionPresetMomentum",
} as const;

type TarotIntentId = keyof typeof INTENT_QUESTION_KEYS;

function normalizeIntentId(value: unknown): TarotIntentId {
  const candidate = String(value ?? "");
  return candidate in INTENT_QUESTION_KEYS
    ? (candidate as TarotIntentId)
    : "decision";
}

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
    // the launcher-selected app.mode.
    const mode = createObservable(app.mode.get());
    const intentId = createObservable<TarotIntentId>("decision");
    const assetRecoveryCount = createObservable(0);
    const assetRetryNonce = createObservable(0);

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
      storage: app.storage.local,
      t: ctx.t,
      setStatus: ctx.setStatus,
    });
    // Track mode changes for the UI and, on switching to guest, reset to a clean
    // local reading (replacing the on-chain reads done on mount).
    app.mode.onChange((next) => {
      mode.set(next);
      if (next === "guest") {
        intentId.set("decision");
        void guest.enter();
      }
    });

    const drawReading = async () => {
      if (app.mode.isGuest()) {
        await guest.draw();
        app.notify.success("cardsDrawn");
        return;
      }
      // Defence in depth: the launcher gate and published manifests both force
      // guest mode today, but a stale host must not be able to reach the paid
      // draw path while the GameFi deployment is explicitly disabled.
      if (manifest.supportsGameFi === false) {
        throw new Error(ctx.t("entryGameFiUnavailable"));
      }
      const outcome = await tarot.draw();
      if (outcome.status === "pending") {
        app.notify.success("readingRequested");
      }
      return outcome;
    };
    app.actions.register("draw", drawReading);
    // Kept as a compatibility alias for old deep links; the published operation
    // panel is empty and the maintenance guard above still applies.
    app.actions.register("drawTarotReading", drawReading);

    // reset / flipCard / setIntent / copyReading are pure client-side (no chain,
    // oracle, or reward call in either mode), so they work as-is in guest without
    // branching — they never touch a guarded surface.
    app.actions.register("reset", async () => {
      tarot.reset();
    });

    app.actions.register("flipCard", async (index: unknown) => {
      tarot.flipCard(Number(index));
    });

    app.actions.register("flipTarotReading", async () => {
      tarot.drawn.get().forEach((_card, index) => tarot.flipCard(index));
    });

    app.actions.register("setIntent", async (value: unknown) => {
      const nextIntent = normalizeIntentId(value);
      intentId.set(nextIntent);
      tarot.question.set(ctx.t(INTENT_QUESTION_KEYS[nextIntent]));
    });

    // Critical artwork recovery remains a local scene concern, but mirror its
    // state into React so screen-reader and keyboard users receive the same
    // fail-clear retry path as pointer users on the Phaser canvas.
    app.actions.register("setAssetRecoveryState", async (value: unknown) => {
      const count = Math.max(0, Math.min(6, Math.floor(Number(value) || 0)));
      assetRecoveryCount.set(count);
    });

    app.actions.register("retryTarotAssets", async () => {
      if (assetRecoveryCount.get() <= 0) return;
      assetRetryNonce.set(assetRetryNonce.get() + 1);
    });

    app.actions.register("copyReading", async () => {
      await tarot.copyReading();
    });

    app.actions.register("refreshReadingState", async () => {
      if (app.mode.isGuest()) {
        await guest.refresh();
        return;
      }
      const previousMode = tarot.readingMode.get();
      await tarot.loadAll();
      const nextMode = tarot.readingMode.get();
      if (previousMode === "pending" && nextMode === "oracle") {
        app.notify.success("cardsReady");
      } else if (previousMode === "pending" && nextMode === "refunded") {
        app.notify.success("readingFeeRestored");
      }
    });

    app.actions.register("recoverExpiredReading", async () => {
      if (app.mode.isGuest()) return;
      const { amount } = await tarot.refundExpiredReading();
      if (amount > 0) {
        app.notify.success("readingFeeRecovered", {
          amount: Number(amount.toFixed(4)),
          tokenGas: ctx.t("tokenGas"),
        });
      }
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
        readingFee: tarot.readingFee,
        oracleFee: tarot.oracleFee,
        hasPending: tarot.hasPending,
        pendingReadingId: tarot.pendingReadingId,
        pendingRequestId: tarot.pendingRequestId,
        pendingExpiresAt: tarot.pendingExpiresAt,
        pendingExpired: tarot.pendingExpired,
        refundReason: tarot.refundReason,
        walletAddress: tarot.address,
        mode,
        intentId,
        assetRecoveryCount,
        assetRetryNonce,
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
