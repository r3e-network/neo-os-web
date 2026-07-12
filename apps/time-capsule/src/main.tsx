/**
 * Time Capsule — Entry Point (React / OS Services Pattern)
 */

import { defineMiniApp } from "@shared/react/defineMiniApp";
import PlayArea from "./PlayArea";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import { useTimeCapsule, type CapsuleFormData } from "./composables/useTimeCapsule";

const DEFAULT_CAPSULE_FORM: CapsuleFormData = {
  title: "",
  content: "",
  days: "30",
  isPublic: false,
  category: 1,
};

function normalizeCapsulePayload(payload: unknown): CapsuleFormData {
  const data =
    payload && typeof payload === "object"
      ? (payload as Partial<CapsuleFormData>)
      : DEFAULT_CAPSULE_FORM;
  const category = Number(data.category ?? DEFAULT_CAPSULE_FORM.category);
  const days = Number.parseInt(String(data.days ?? DEFAULT_CAPSULE_FORM.days), 10);
  return {
    title: String(data.title ?? "").slice(0, 100),
    content: String(data.content ?? ""),
    days: Number.isFinite(days)
      ? String(Math.min(3650, Math.max(1, days)))
      : DEFAULT_CAPSULE_FORM.days,
    isPublic: Boolean(data.isPublic),
    category: Number.isFinite(category)
      ? Math.min(5, Math.max(1, Math.round(category)))
      : DEFAULT_CAPSULE_FORM.category,
  };
}

defineMiniApp({
  appId: "miniapp-time-capsule",
  playArea: PlayArea,
  manifest,
  messages,
  // Legacy on-device namespace: the content/meta stores predate the framework
  // storage surface and live under "time-capsule-content"/"time-capsule-meta".
  // This prefix keeps app.storage.local resolving those exact keys so existing
  // users keep their sealed messages (plan §3 Wave 4 migration hazard).
  storagePrefix: "time-capsule-",

  setup(ctx) {
    const capsule = useTimeCapsule({
      app: ctx.framework,
      t: ctx.t,
    });

    ctx.framework.actions.register("createCapsule", async (payload?: unknown) => {
      if (payload !== undefined) capsule.newCapsule.set(normalizeCapsulePayload(payload));
      await capsule.createCapsule().catch((error) => {
        ctx.framework.notify.error(error, "error");
      });
    });

    // fishCapsule surfaces its own DYNAMIC toast (tipped #id / nothing-found /
    // error) on the platform notification channel — the result depends on which
    // capsule (if any) was tipped at runtime, so a static successKey cannot
    // express it. Swallow the rethrow here to avoid a duplicate error toast.
    // An optional capsule id lets the user tip a specific capsule they picked
    // from the browsable list; without one it tips the newest tippable capsule.
    ctx.framework.actions.register("fishCapsule", async (targetId?: unknown) => {
      await capsule
        .fishCapsule(targetId == null ? undefined : String(targetId))
        .catch(() => {
          /* toast already surfaced inside the composable */
        });
    });

    // loadFishCandidates refreshes the browsable list of public, tippable
    // capsules from other users (read-only on-chain scan). No toast.
    ctx.framework.actions.register("loadFishCandidates", async () => {
      await capsule.loadFishCandidates().catch(() => {
        /* read-only refresh; failures already logged in the composable */
      });
    });

    ctx.framework.actions.register("openCapsule", async (cap: unknown) => {
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
    ctx.framework.actions.register("withdrawCredit", async () => {
      await capsule.withdrawCredit().catch(() => {
        /* toast already surfaced inside the composable */
      });
    });

    ctx.framework.actions.register("recoverPending", async () => {
      await capsule.recoverPending().catch((error) => {
        ctx.framework.notify.error(error, "error");
      });
    });

    return {
      state: {
        address: ctx.framework.chain.address,
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
        fishCandidates: capsule.fishCandidates,
        isLoadingCandidates: capsule.isLoadingCandidates,
        capsulesSource: capsule.capsulesSource,
        candidatesSource: capsule.candidatesSource,
        creditSource: capsule.creditSource,
        transactionNotice: capsule.transactionNotice,
        pendingOperation: capsule.pendingOperation,
        isRecovering: capsule.isRecovering,
        storageHealthy: capsule.storageHealthy,
      },
      loadData: async () => {
        await capsule.loadAll();
        // Populate the browsable list of public, tippable capsules so the user
        // can pick a target before paying a tip (read-only on-chain scan).
        await capsule.loadFishCandidates().catch(() => {
          /* read-only refresh; failures already logged in the composable */
        });
      },
    };
  },
});
