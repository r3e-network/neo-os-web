/**
 * Graveyard — Entry Point (React)
 */

import { defineMiniApp, refsToObservables } from "@shared/react";
import PlayArea from "./PlayArea";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import { useGraveyard, type BurialDraftInput } from "./composables/useGraveyard";
import type { HistoryItem } from "./types";

defineMiniApp({
  appId: "miniapp-graveyard",
  playArea: PlayArea,
  manifest,
  messages,

  setup(ctx) {
    const graveyard = useGraveyard({
      app: ctx.framework,
      t: ctx.t,
    });

    ctx.framework.actions.register("initiateDestroy", async () => {
      graveyard.initiateDestroy();
    });
    ctx.framework.actions.register("cancelDestroy", async () => {
      graveyard.cancelDestroy();
    });
    ctx.framework.actions.register("setComposeMode", async (mode: unknown) => {
      graveyard.setComposeMode(mode === "hash" ? "hash" : "write");
    });
    ctx.framework.actions.register("setMemoryText", async (text: unknown) => {
      if (text && typeof text === "object" && !Array.isArray(text)) {
        const draft = text as BurialDraftInput;
        if (draft.composeMode === "hash" || draft.composeMode === "write") {
          graveyard.setComposeMode(draft.composeMode);
        }
        await graveyard.setMemoryText(
          String(draft.memoryText ?? draft.assetHash ?? ""),
          draft.composeMode === "hash" ? "hash" : "write",
        );
        return;
      }
      await graveyard.setMemoryText(String(text ?? ""));
    });
    ctx.framework.actions.register("executeDestroy", async (draft: unknown) => {
      await ctx.framework.notify.guard(
        () => graveyard.executeDestroy(draft as BurialDraftInput),
        { successKey: "memoryBuried" },
      );
    });
    ctx.framework.actions.register("requestForget", async (item: unknown) => {
      graveyard.requestForget(item as HistoryItem);
    });
    ctx.framework.actions.register("cancelForget", async () => {
      graveyard.cancelForget();
    });
    ctx.framework.actions.register("forgetMemory", async (item: unknown) => {
      await ctx.framework.notify.guard(
        () => graveyard.forgetMemory(item as HistoryItem),
        { successKey: "forgetSuccess" },
      );
    });
    ctx.framework.actions.register("startEpitaph", async (item: unknown) => {
      graveyard.startEpitaph(item as HistoryItem);
    });
    ctx.framework.actions.register("cancelEpitaph", async () => {
      graveyard.cancelEpitaph();
    });
    ctx.framework.actions.register("setEpitaphText", async (text: unknown) => {
      graveyard.epitaphText.set(String(text ?? ""));
    });
    ctx.framework.actions.register("saveEpitaph", async (item: unknown) => {
      await ctx.framework.notify.guard(
        () => graveyard.saveEpitaph(item as HistoryItem),
        { successKey: "epitaphSaved" },
      );
    });
    ctx.framework.actions.register("setShowAllHistory", async (value: unknown) => {
      await graveyard.setShowAllHistory(Boolean(value));
    });
    ctx.framework.actions.register("refreshRecords", async () => {
      await graveyard.loadAll();
    });

    return {
      state: refsToObservables({
        totalDestroyed: graveyard.totalDestroyed,
        burialFeesPaid: graveyard.burialFeesPaid,
        gasReclaimedDisplay: graveyard.gasReclaimedDisplay,
        burialFeeDisplay: graveyard.burialFeeDisplay,
        forgetFeeDisplay: graveyard.forgetFeeDisplay,
        historyCount: graveyard.historyCount,
        historyTruncated: graveyard.historyTruncated,
        history: graveyard.history,
        isDestroying: graveyard.isDestroying,
        forgettingId: graveyard.forgettingId,
        forgetConfirmId: graveyard.forgetConfirmId,
        epitaphDraftId: graveyard.epitaphDraftId,
        epitaphText: graveyard.epitaphText,
        epitaphSavingId: graveyard.epitaphSavingId,
        showAllHistory: graveyard.showAllHistory,
        isLoading: graveyard.isLoading,
        showConfirm: graveyard.showConfirm,
        showWarningShake: graveyard.showWarningShake,
        assetHash: graveyard.assetHash,
        composeMode: graveyard.composeMode,
        memoryText: graveyard.memoryText,
        memoryType: graveyard.memoryType,
        memoryTypeOptions: graveyard.memoryTypeOptions,
      }),
      loadData: graveyard.loadAll,
      cleanup: () => { graveyard.cleanupTimers(); },
    };
  },
});
