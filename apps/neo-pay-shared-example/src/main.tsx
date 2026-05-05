import { defineMiniApp } from "@shared/react/defineMiniApp";
import PlayArea from "./PlayArea";
import { useNeoPayApp } from "../../neo-pay/src/composables/useNeoPayApp";
import { messages as neoPayMessages } from "../../neo-pay/src/locale/messages";
import { manifest } from "./manifest";

defineMiniApp({
  appId: "miniapp-neo-pay-shared-example",
  playArea: PlayArea,
  manifest,
  messages: neoPayMessages,

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
      const totalNum = Number.parseFloat(amount);
      const durationNum = Number.parseFloat(durationDays);
      const rate =
        Number.isFinite(totalNum) && Number.isFinite(durationNum) && durationNum > 0
          ? String(totalNum / durationNum)
          : amount;

      await ctx.services.notify.guard(
        () =>
          pay.handleCreateVault({
            name: `Shared stream to ${recipient.slice(0, 8)}...`,
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
      const stream = findStreamById(String(args[0] ?? ""));
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
      const stream = findStreamById(String(args[0] ?? ""));
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
