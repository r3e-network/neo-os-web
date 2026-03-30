/**
 * Time Capsule — Entry Point (OS Services Pattern)
 *
 * This miniapp uses OS service proxies (ctx.os.escrow, ctx.os.storage,
 * ctx.os.badge) instead of direct chain calls. The proxies handle all
 * contract interaction through edge functions.
 *
 * Architecture:
 *   main.ts -> defineMiniApp({ playArea, manifest, setup })
 *   setup() -> useTimeCapsule({ escrowService, storageService, ... })
 */

import { defineMiniApp } from "@shared/utils/defineMiniApp";
import { registerActions } from "@shared/utils/createActionHandlers";
import PlayArea from "./PlayArea.vue";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import { useTimeCapsule } from "./composables/useTimeCapsule";

defineMiniApp({
  appId: "miniapp-time-capsule",
  playArea: PlayArea,
  manifest,
  messages,

  setup(ctx) {
    const capsule = useTimeCapsule({
      escrowService: ctx.os.escrow,
      storageService: ctx.os.storage,
      badgeService: ctx.os.badge,
      eventBus: ctx.services.events,
      t: ctx.t,
    });

    // Register async actions with standardized error handling
    registerActions(ctx, {
      createCapsule: {
        handler: () => capsule.createCapsule(),
        successKey: "capsuleCreated",
        errorKey: "error",
      },
      fishCapsule: {
        handler: () => capsule.fishCapsule(),
        errorKey: "error",
      },
    });

    ctx.registerAction("openCapsule", async (cap: unknown) => {
      try {
        await capsule.openCapsule(
          cap as Parameters<typeof capsule.openCapsule>[0],
        );
      } catch (e) {
        ctx.setStatus(e instanceof Error ? e.message : ctx.t("error"), "error");
      }
    });

    return {
      state: {
        address: ctx.services.chain.address,
        capsules: capsule.capsules,
        totalCapsules: capsule.totalCapsules,
        lockedCount: capsule.lockedCount,
        revealedCount: capsule.revealedCount,
        isLoading: capsule.isLoading,
        isCreating: capsule.isCreating,
        isProcessing: capsule.isProcessing,
        isBusy: capsule.isBusy,
        newCapsule: capsule.newCapsule,
        canCreate: capsule.canCreate,
      },
      loadData: capsule.loadAll,
    };
  },
});
