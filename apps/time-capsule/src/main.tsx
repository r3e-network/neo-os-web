/**
 * Time Capsule — Entry Point (React / OS Services Pattern)
 */

import { defineMiniApp } from "@shared/react/defineMiniApp";
import { registerActions } from "@shared/utils/createActionHandlers";
import PlayArea from "./PlayArea";
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
