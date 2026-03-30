/**
 * Graveyard — Entry Point (OS Services Pattern)
 *
 * This miniapp uses OS service proxies (ctx.os.nft, ctx.os.storage,
 * ctx.os.badge) instead of direct chain calls. The proxies handle all
 * contract interaction through edge functions.
 *
 * Architecture:
 *   main.ts -> defineMiniApp({ playArea, manifest, setup })
 *   setup() -> useGraveyard({ nftService, storageService, ... })
 */

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
    const { notify } = ctx.services;

    const graveyard = useGraveyard({
      nftService: ctx.os.nft,
      storageService: ctx.os.storage,
      badgeService: ctx.os.badge,
      eventBus: ctx.services.events,
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
