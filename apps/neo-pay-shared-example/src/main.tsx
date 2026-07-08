import { defineMiniApp } from "@shared/react/defineMiniApp";
import PlayArea from "./PlayArea";
import { manifest } from "./manifest";
// Canonical shared Neo Pay domain module (composable + schedule derivation +
// locale messages), shared with the neo-pay miniapp through the shared package
// instead of a cross-app source import. deriveSchedule is also what PlayArea
// uses, so the on-screen preview and the dispatched transaction agree on the
// exact per-interval rate / interval (unit-tested in neo-pay.logic.test.ts).
import {
  deriveSchedule,
  messages as neoPayMessages,
  useNeoPayApp,
} from "@shared/composables/neo-pay";

defineMiniApp({
  appId: "miniapp-neo-pay-shared-example",
  playArea: PlayArea,
  manifest,
  messages: neoPayMessages,

  setup(ctx) {
    const app = ctx.framework;
    const pay = useNeoPayApp({
      app,
      t: ctx.t,
    });

    const findStreamById = (id: string) =>
      pay.allStreams.get().find((s) => String(s.id) === id) ?? null;

    ctx.framework.actions.register("createStream", async (...args: unknown[]) => {
      const form = (args[0] ?? {}) as {
        recipient?: string;
        amount?: string;
        duration?: string;
        token?: string;
        title?: string;
        notes?: string;
      };
      const recipient = String(form.recipient ?? "").trim();
      const amount = String(form.amount ?? "").trim();
      const durationDays = String(form.duration ?? "").trim();
      const title = String(form.title ?? "").trim();
      const token =
        String(form.token ?? "GAS").trim().toUpperCase() === "NEO"
          ? "NEO"
          : "GAS";
      const { rate, intervalDays } = deriveSchedule(amount, durationDays, token);

      await app.notify.guard(
        () =>
          pay.handleCreateVault({
            name: title || `Shared stream to ${recipient.slice(0, 8)}...`,
            beneficiary: recipient,
            asset: token,
            total: amount,
            rate,
            intervalDays,
            notes: String(form.notes ?? ""),
          }),
        { successKey: "streamCreated" },
      );
    });

    ctx.framework.actions.register("cancelStream", async (...args: unknown[]) => {
      const input = (args[0] ?? {}) as { streamId?: string } | string;
      const id =
        typeof input === "string"
          ? input
          : String(input.streamId ?? "");
      const stream = findStreamById(id);
      if (!stream) {
        ctx.setStatus(ctx.t("streamNotFound") || "Stream not found", "error");
        return;
      }
      await app.notify.guard(
        () => pay.cancelStream(stream),
        { successKey: "streamCancelled" },
      );
    });

    ctx.framework.actions.register("claimStream", async (...args: unknown[]) => {
      const input = (args[0] ?? {}) as { streamId?: string } | string;
      const id =
        typeof input === "string"
          ? input
          : String(input.streamId ?? "");
      const stream = findStreamById(id);
      if (!stream) {
        ctx.setStatus(ctx.t("streamNotFound") || "Stream not found", "error");
        return;
      }
      await app.notify.guard(
        () => pay.claimStream(stream),
        { successKey: "streamClaimed" },
      );
    });

    return {
      state: {
        createdStreams: pay.createdStreams,
        beneficiaryStreams: pay.beneficiaryStreams,
        isLoading: pay.isLoading,
        // isCreating is its own observable (set only during the create flow); binding
        // it to isLoading made the Create button miss its spinner/disabled state during
        // a create and spuriously spin during the initial list load.
        isCreating: pay.isCreating,
        isRefreshing: pay.isRefreshing,
        claimingId: pay.claimingId,
        cancellingId: pay.cancellingId,
        serviceNotice: pay.serviceNotice,
        allStreams: pay.allStreams,
        activeCount: pay.activeCount,
        createdStreamCount: pay.createdStreamCount,
        beneficiaryStreamCount: pay.beneficiaryStreamCount,
        totalStreamCount: pay.totalStreamCount,
      },
      loadData: pay.loadAll,
    };
  },
});
