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
      chainService: ctx.services.chain,
      eventBus: ctx.services.events,
      t: ctx.t,
    });

    registerActions(ctx, {
      createCapsule: {
        handler: () => capsule.createCapsule(),
        successKey: "capsuleCreated",
        errorKey: "error",
      },
    });

    // fishCapsule surfaces its own DYNAMIC toast (fished #id / nothing-found /
    // error) on the platform notification channel — the result depends on which
    // capsule (if any) was discovered at runtime, so a static successKey cannot
    // express it. Swallow the rethrow here to avoid a duplicate error toast.
    ctx.registerAction("fishCapsule", async () => {
      await capsule.fishCapsule().catch(() => {
        /* toast already surfaced inside the composable */
      });
    });

    ctx.registerAction("openCapsule", async (cap: unknown) => {
      // openCapsule emits its own dynamic toasts (reveal confirmation + the
      // on-device message / hash fallback) on the platform notification channel.
      await capsule.openCapsule(
        cap as Parameters<typeof capsule.openCapsule>[0],
      ).catch(() => {
        /* toast already surfaced inside the composable */
      });
    });

    // withdrawCredit emits its own dynamic success / "no credit" toast (the amount
    // is only known at runtime) on the platform notification channel.
    ctx.registerAction("withdrawCredit", async () => {
      await capsule.withdrawCredit().catch(() => {
        /* toast already surfaced inside the composable */
      });
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
        reusableCredit: capsule.reusableCredit,
        hasCredit: capsule.hasCredit,
      },
      loadData: capsule.loadAll,
    };
  },
});
