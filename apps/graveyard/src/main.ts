import { defineMiniApp } from "@shared/utils/defineMiniApp";
import { PlatformServices } from "@shared/services";
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
    const platformServices = PlatformServices.create("miniapp-graveyard", {
      t: ctx.t as (key: string) => string,
    });

    const graveyard = useGraveyard({
      chain: platformServices.chain,
      eventBus: platformServices.events,
      t: ctx.t,
    });

    ctx.registerAction("executeDestroy", async () => {
      try {
        await graveyard.executeDestroy();
        ctx.setStatus(ctx.t("memoryBuried"), "success");
      } catch (e) {
        ctx.setStatus(e instanceof Error ? e.message : ctx.t("error"), "error");
      }
    });

    ctx.registerAction("forgetMemory", async (item: unknown) => {
      try {
        await graveyard.forgetMemory(item as { id: string; forgotten: boolean });
        ctx.setStatus(ctx.t("forgetSuccess"), "success");
      } catch (e) {
        ctx.setStatus(e instanceof Error ? e.message : ctx.t("error"), "error");
      }
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
        platformServices.destroy();
      },
    };
  },
});
