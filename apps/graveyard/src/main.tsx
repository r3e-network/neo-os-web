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
    ctx.registerAction("executeDestroy", async () => {
      await notify.guard(() => graveyard.executeDestroy(), "memoryBuried");
    });
    ctx.registerAction("forgetMemory", async (item: unknown) => {
      await notify.guard(
        () => graveyard.forgetMemory(item as HistoryItem),
        "forgetSuccess",
      );
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
        historyCount: graveyard.historyCount,
        history: graveyard.history,
        isDestroying: graveyard.isDestroying,
        forgettingId: graveyard.forgettingId,
        isLoading: graveyard.isLoading,
        showConfirm: graveyard.showConfirm,
        showWarningShake: graveyard.showWarningShake,
        assetHash: graveyard.assetHash,
        memoryType: graveyard.memoryType,
        memoryTypeOptions: graveyard.memoryTypeOptions,
      }),
      loadData: graveyard.loadAll,
      cleanup: () => { graveyard.cleanupTimers(); },
    };
  },
});
