/**
 * Neo Pay — React Entry Point
 */

import { defineMiniApp } from "@shared/react/defineMiniApp";
import PlayArea from "./PlayArea";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import { useNeoPayApp } from "./composables/useNeoPayApp";

defineMiniApp({
  appId: "miniapp-neo-pay",
  playArea: PlayArea,
  manifest,
  messages,

  setup(ctx) {
    const pay = useNeoPayApp({
      vestingService: ctx.os.vesting,
      paymentService: ctx.os.payment,
      t: ctx.t,
    });

    const findStreamById = (id: string) =>
      pay.allStreams.get().find((s) => String(s.id) === id) ?? null;

    ctx.registerAction("createStream", async (...args: unknown[]) => {
      const form = (args[0] ?? {}) as {
        recipient?: string;
        amount?: string;
        duration?: string;
        token?: string;
        notes?: string;
      };
      const recipient = String(form.recipient ?? "").trim();
      const amount = String(form.amount ?? "").trim();
      const durationDays = String(form.duration ?? "").trim();
      const token = String(form.token ?? "GAS").trim().toUpperCase();
      // Linear vesting: rate = total / durationDays (per interval of 1 day)
      const totalNum = Number.parseFloat(amount);
      const durationNum = Number.parseFloat(durationDays);
      const rate =
        Number.isFinite(totalNum) && Number.isFinite(durationNum) && durationNum > 0
          ? String(totalNum / durationNum)
          : amount;

      await ctx.services.notify.guard(
        () =>
          pay.handleCreateVault({
            name: `Stream to ${recipient.slice(0, 8)}...`,
            beneficiary: recipient,
            asset: token,
            total: amount,
            rate,
            intervalDays: "1",
            notes: String(form.notes ?? ""),
          }),
        "streamCreated",
      );
    });

    ctx.registerAction("cancelStream", async (...args: unknown[]) => {
      const id = String(args[0] ?? "");
      const stream = findStreamById(id);
      if (!stream) {
        ctx.setStatus(ctx.t("streamNotFound") || "Stream not found", "error");
        return;
      }
      await ctx.services.notify.guard(
        () => pay.cancelStream(stream),
        "streamCancelled",
      );
    });

    ctx.registerAction("claimStream", async (...args: unknown[]) => {
      const id = String(args[0] ?? "");
      const stream = findStreamById(id);
      if (!stream) {
        ctx.setStatus(ctx.t("streamNotFound") || "Stream not found", "error");
        return;
      }
      await ctx.services.notify.guard(
        () => pay.claimStream(stream),
        "streamClaimed",
      );
    });

    return {
      state: {
        createdStreams: pay.createdStreams,
        beneficiaryStreams: pay.beneficiaryStreams,
        isLoading: pay.isLoading,
        // composable doesn't track isCreating separately — surface isLoading + isRefreshing
        isCreating: pay.isLoading,
        isRefreshing: pay.isRefreshing,
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
