import { defineMiniApp } from "@shared/react/defineMiniApp";
import PlayArea from "./PlayArea";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import { useNeoPayProduction, type NeoPayActionOutcome } from "./useNeoPayProduction";

defineMiniApp({
  appId: "miniapp-neo-pay",
  playArea: PlayArea,
  manifest,
  messages,

  setup(ctx) {
    const app = ctx.framework;
    const pay = useNeoPayProduction({ app, t: ctx.t });

    const report = (
      result: NeoPayActionOutcome,
      confirmedKey: "streamCreated" | "streamClaimed" | "streamCancelled",
    ) => {
      if (result.status === "confirmed") app.notify.success(confirmedKey);
      else if (result.status === "fault") app.notify.error(new Error(ctx.t("neoPayTransactionFault")));
      else app.notify.info("neoPayTransactionPending");
    };

    app.actions.register("createStream", async (...args: unknown[]) => {
      const form = (args[0] ?? {}) as {
        recipient?: string;
        amount?: string;
        duration?: string;
        token?: string;
        notes?: string;
      };
      try {
        const result = await pay.createStream({
          recipient: String(form.recipient ?? "").trim(),
          amount: String(form.amount ?? "").trim(),
          durationDays: String(form.duration ?? "").trim(),
          asset: String(form.token ?? "GAS").toUpperCase() === "NEO" ? "NEO" : "GAS",
          notes: String(form.notes ?? ""),
        });
        report(result, "streamCreated");
      } catch (error) {
        app.notify.error(error, "streamActionUnavailable");
      }
    });

    app.actions.register("claimStream", async (...args: unknown[]) => {
      const input = (args[0] ?? {}) as { streamId?: string } | string;
      const id = typeof input === "string" ? input : String(input.streamId ?? "");
      try {
        report(await pay.claimStream(id), "streamClaimed");
      } catch (error) {
        app.notify.error(error, "streamActionUnavailable");
      }
    });

    app.actions.register("cancelStream", async (...args: unknown[]) => {
      const input = (args[0] ?? {}) as { streamId?: string } | string;
      const id = typeof input === "string" ? input : String(input.streamId ?? "");
      try {
        report(await pay.cancelStream(id), "streamCancelled");
      } catch (error) {
        app.notify.error(error, "streamActionUnavailable");
      }
    });

    app.actions.register("recoverTransaction", async () => {
      try {
        const result = await pay.recoverPending();
        if (!result) return;
        if (result.status === "confirmed") app.notify.success("neoPayTransactionRecovered");
        else if (result.status === "fault") app.notify.error(new Error(ctx.t("neoPayTransactionFault")));
        else app.notify.info("neoPayTransactionPending");
      } catch (error) {
        app.notify.error(error, "streamActionUnavailable");
      }
    });

    app.actions.register("refreshStreams", pay.refreshStreams);
    app.actions.register("refreshRecoveryStorage", async () => {
      try {
        await pay.refreshRecoveryStorage();
        app.notify.success("neoPayRecoveryStorageRestored");
      } catch (error) {
        app.notify.error(error, "streamActionUnavailable");
      }
    });

    return {
      state: {
        createdStreams: pay.createdStreams,
        beneficiaryStreams: pay.beneficiaryStreams,
        isLoading: pay.isLoading,
        isCreating: pay.isCreating,
        isRecovering: pay.isRecovering,
        isRefreshing: pay.isRefreshing,
        claimingId: pay.claimingId,
        cancellingId: pay.cancellingId,
        serviceNotice: pay.serviceNotice,
        pendingCreateTxid: pay.pendingTxid,
        pendingTxid: pay.pendingTxid,
        listSource: pay.listSource,
        activeAction: pay.activeAction,
        operationBusy: pay.operationBusy,
        recoveryStorageHealthy: pay.recoveryStorageHealthy,
        allStreams: pay.allStreams,
        activeCount: pay.activeCount,
        createdStreamCount: pay.createdStreamCount,
        beneficiaryStreamCount: pay.beneficiaryStreamCount,
        totalStreamCount: pay.totalStreamCount,
      },
      loadData: pay.loadAll,
      cleanup: pay.cleanup,
    };
  },
});
