/**
 * Memorial Shrine — Entry Point (React)
 */

import { defineMiniApp, refsToObservables } from "@shared/react";
import PlayArea from "./PlayArea";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import { useMemorialShrine } from "./composables/useMemorialShrine";
import type { MemorialDraftInput } from "./logic/memorial-draft";

defineMiniApp({
  appId: "miniapp-memorial-shrine",
  playArea: PlayArea,
  manifest,
  messages,
  // Pin app.storage.local to the legacy runtime-cache namespace so the
  // pre-framework "memorial-shrine-visited" key keeps resolving byte-for-byte.
  storagePrefix: "memorial-shrine-",

  setup(ctx) {
    const shrine = useMemorialShrine({
      app: ctx.framework,
      launchNetwork: ctx.launchContext.network,
      t: ctx.t,
    });

    ctx.framework.actions.register("openMemorial", async (...args: unknown[]) => {
      shrine.openMemorial(Number(args[0]));
    });
    ctx.framework.actions.register("closeMemorial", async () => {
      shrine.closeMemorial();
    });
    ctx.framework.actions.register("shareMemorial", async (...args: unknown[]) => {
      const id = Number(args[0]);
      const memorial = Number.isFinite(id)
        ? shrine.memorials.get().find((m) => m.id === id)
        : undefined;
      await shrine.shareMemorial(memorial);
    });
    ctx.framework.actions.register("createMemorial", async (...args: unknown[]) => {
      const form = args[0] as MemorialDraftInput;
      await shrine.createMemorial(form);
    });
    ctx.framework.actions.register("refreshMemorials", async () => {
      await shrine.loadAll();
    });
    ctx.framework.actions.register("payTribute", async (...args: unknown[]) => {
      const [memorialId, offeringType, message, receiptId] = args;
      await shrine.payTribute(
        Number(memorialId),
        Number(offeringType),
        String(message ?? ""),
        receiptId == null ? undefined : String(receiptId),
      );
    });
    ctx.framework.actions.register("recoverPendingWrite", async () => {
      await shrine.confirmPendingWrite();
    });

    return {
      state: refsToObservables({
        memorials: shrine.memorials,
        visitedMemorials: shrine.visitedMemorials,
        myTributes: shrine.myTributes,
        recentObituaries: shrine.recentObituaries,
        selectedMemorial: shrine.selectedMemorial,
        shareStatus: shrine.shareStatus,
        catalogStatus: shrine.catalogStatus,
        catalogError: shrine.catalogError,
        networkStatus: shrine.networkStatus,
        networkMessage: shrine.networkMessage,
        memorialCount: shrine.memorialCount,
        tributeCount: shrine.tributeCount,
        obituaryCount: shrine.obituaryCount,
        isSubmitting: shrine.isSubmitting,
        isPaying: shrine.isPaying,
        confirmationChecking: shrine.confirmationChecking,
        pendingWrite: shrine.pendingWrite,
        writePhase: shrine.writePhase,
        writeNotice: shrine.writeNotice,
        writeError: shrine.writeError,
        storageHealthy: shrine.storageHealthy,
        lastTx: shrine.lastTx,
      }),
      loadData: shrine.loadAll,
      cleanup: () => { shrine.cleanupTimers(); },
    };
  },
});
