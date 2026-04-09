/**
 * Red Envelope — React Entry Point
 */

import { defineMiniApp } from "@shared/react/defineMiniApp";
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

    ctx.registerAction("createEnvelope", async (formData: unknown) => {
      await ctx.services.notify.guard(
        () => envelope.createEnvelope(formData as Record<string, unknown>),
        "envelopeCreated",
      );
    });

    ctx.registerAction("openEnvelope", async (id: unknown) => {
      await ctx.services.notify.guard(
        () => envelope.openEnvelope(String(id)),
        "envelopeOpened",
      );
    });

    ctx.registerAction("claimEnvelope", async (id: unknown) => {
      await ctx.services.notify.guard(
        () => envelope.claimEnvelope(String(id)),
        "envelopeClaimed",
      );
    });

    ctx.registerAction("dismissOverlay", async () => {
      envelope.luckyMessage.set(null);
    });

    ctx.registerAction("dismissOpeningModal", async () => {
      envelope.showOpeningModal.set(false);
    });

    return {
      state: {
        envelopes: envelope.envelopes,
        claims: envelope.claims,
        pools: envelope.pools,
        isLoading: envelope.isLoading,
        isCreating: envelope.isCreating,
        luckyMessage: envelope.luckyMessage,
        showOpeningModal: envelope.showOpeningModal,
        openingEnvelope: envelope.openingEnvelope,
        envelopeCount: envelope.envelopeCount,
        claimCount: envelope.claimCount,
        poolCount: envelope.poolCount,
        totalCreated: envelope.totalCreated,
        totalClaimed: envelope.totalClaimed,
        createAmount: envelope.createAmount,
        createCount: envelope.createCount,
        createMemo: envelope.createMemo,
      },
      loadData: envelope.loadAll,
    };
  },
});
