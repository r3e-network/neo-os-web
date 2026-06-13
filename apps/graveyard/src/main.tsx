/**
 * Graveyard — Entry Point (React)
 */

import { defineMiniApp, refsToObservables } from "@shared/react";
import PlayArea from "./PlayArea";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import { useGraveyard } from "./composables/useGraveyard";
import type { HistoryItem } from "./types";

defineMiniApp({
  appId: "miniapp-graveyard",
  playArea: PlayArea,
  manifest,
  messages,

  setup(ctx) {
    const { notify } = ctx.services;

    const graveyard = useGraveyard({
      chain: ctx.services.chain,
      eventBus: ctx.services.events,
      t: ctx.t,
    });

    ctx.registerAction("initiateDestroy", async () => {
      graveyard.initiateDestroy();
    });
    ctx.registerAction("cancelDestroy", async () => {
      graveyard.cancelDestroy();
    });
    ctx.registerAction("setComposeMode", async (mode: unknown) => {
      graveyard.setComposeMode(mode === "hash" ? "hash" : "write");
    });
    ctx.registerAction("setMemoryText", async (text: unknown) => {
      await graveyard.setMemoryText(String(text ?? ""));
    });
    ctx.registerAction("executeDestroy", async () => {
      await notify.guard(() => graveyard.executeDestroy(), "memoryBuried");
    });
    ctx.registerAction("requestForget", async (item: unknown) => {
      graveyard.requestForget(item as HistoryItem);
    });
    ctx.registerAction("cancelForget", async () => {
      graveyard.cancelForget();
    });
    ctx.registerAction("forgetMemory", async (item: unknown) => {
      await notify.guard(
        () => graveyard.forgetMemory(item as HistoryItem),
        "forgetSuccess",
      );
    });
    ctx.registerAction("startEpitaph", async (item: unknown) => {
      graveyard.startEpitaph(item as HistoryItem);
    });
    ctx.registerAction("cancelEpitaph", async () => {
      graveyard.cancelEpitaph();
    });
    ctx.registerAction("setEpitaphText", async (text: unknown) => {
      graveyard.epitaphText.set(String(text ?? ""));
    });
    ctx.registerAction("saveEpitaph", async (item: unknown) => {
      await notify.guard(
        () => graveyard.saveEpitaph(item as HistoryItem),
        "epitaphSaved",
      );
    });
    ctx.registerAction("setShowAllHistory", async (value: unknown) => {
      await graveyard.setShowAllHistory(Boolean(value));
    });
    ctx.registerAction("refreshRecords", async () => {
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
