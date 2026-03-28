/**
 * Time Capsule — Entry Point (New Pattern)
 *
 * Uses defineMiniApp() to wire the time capsule domain logic to the platform.
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
    const platformServices = ctx.services;

    const capsule = useTimeCapsule({
      chain: platformServices.chain,
      eventBus: platformServices.events,
      t: ctx.t,
    });

    // Register actions for PlayArea dispatch
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
        address: platformServices.chain.address,
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
