/**
 * Red Envelope — React Entry Point
 */

import { defineMiniApp, createObservable, createDerived } from "@shared/react/defineMiniApp";
import PlayArea from "./PlayArea";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import { useRedEnvelope } from "./composables/useRedEnvelope";

defineMiniApp({
  appId: "miniapp-red-envelope",
  playArea: PlayArea,
  manifest,
  messages,

  setup(ctx) {
    const envelope = useRedEnvelope({
      gameService: ctx.os.game,
      paymentService: ctx.os.payment,
      storageService: ctx.os.storage,
      badgeService: ctx.os.badge,
      t: ctx.t,
    });

    ctx.registerAction("createEnvelope", async (...args: unknown[]) => {
      const form = (args[0] ?? {}) as {
        amount?: string;
        count?: string;
        expiryHours?: string;
        memo?: string;
      };
      await ctx.services.notify.guard(
        () =>
          envelope.create({
            amount: String(form.amount ?? ""),
            count: String(form.count ?? "1"),
            expiryHours: String(form.expiryHours ?? "24"),
          }),
        "envelopeCreated",
      );
    });

    ctx.registerAction("claimEnvelope", async (...args: unknown[]) => {
      const id = String(args[0] ?? "");
      await ctx.services.notify.guard(
        () => envelope.claimEnvelope(id),
        "envelopeClaimed",
      );
    });

    ctx.registerAction("dismissOverlay", async () => {
      envelope.luckyMessage.set(null);
    });

    ctx.registerAction("dismissOpeningModal", async () => {
      envelope.showOpeningModal.set(false);
    });

    // Synthetic stats (composable doesn't expose totalCreated/totalClaimed yet)
    const totalCreated = createDerived(
      () => envelope.envelopes.get().reduce((sum, e) => sum + (Number(e.totalAmount) || 0), 0),
      [envelope.envelopes],
    );
    const totalClaimed = createDerived(
      () => envelope.claims.get().reduce((sum, c) => sum + (Number((c as unknown as { amount?: number }).amount ?? 0)), 0),
      [envelope.claims],
    );
    const createAmount = createObservable("");
    const createCount = createObservable("");
    const createMemo = createObservable("");

    return {
      state: {
        envelopes: envelope.envelopes,
        claims: envelope.claims,
        pools: envelope.pools,
        isLoading: envelope.isLoading,
        // composable folds isCreating into isLoading
        isCreating: envelope.isLoading,
        luckyMessage: envelope.luckyMessage,
        showOpeningModal: envelope.showOpeningModal,
        openingEnvelope: envelope.openingEnvelope,
        envelopeCount: envelope.envelopeCount,
        claimCount: envelope.claimCount,
        poolCount: envelope.poolCount,
        totalCreated,
        totalClaimed,
        createAmount,
        createCount,
        createMemo,
      },
      loadData: envelope.loadAll,
    };
  },
});
