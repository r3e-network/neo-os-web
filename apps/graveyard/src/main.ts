import { defineMiniApp } from "@shared/utils/defineMiniApp";
import PlayArea from "./PlayArea.vue";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import { useGraveyard } from "./composables/useGraveyard";

defineMiniApp({
  appId: "miniapp-graveyard",
  playArea: PlayArea,
  manifest,
  messages,

  setup(ctx) {
    const platformServices = ctx.services;

    const { notify } = platformServices;

    const graveyard = useGraveyard({
      chain: platformServices.chain,
      eventBus: platformServices.events,
      t: ctx.t,
    });

    ctx.registerAction("executeDestroy", async () => {
      await notify.guard(() => graveyard.executeDestroy(), "memoryBuried");
    });

    ctx.registerAction("forgetMemory", async (item: unknown) => {
      await notify.guard(
        () =>
          graveyard.forgetMemory(item as { id: string; forgotten: boolean }),
        "forgetSuccess",
      );
    });

    return {
      state: {
        totalDestroyed: graveyard.totalDestroyed,
        gasReclaimed: graveyard.gasReclaimed,
        gasReclaimedDisplay: graveyard.gasReclaimedDisplay,
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
      },
      loadData: graveyard.loadAll,
      cleanup: () => {
        graveyard.cleanupTimers();
      },
    };
  },
});
