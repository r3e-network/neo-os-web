import { defineMiniApp } from "@shared/react/defineMiniApp";
import PlayArea from "./PlayArea";
import { useNeoPayApp } from "../../neo-pay/src/composables/useNeoPayApp";
import { messages as neoPayMessages } from "../../neo-pay/src/locale/messages";
import { manifest } from "./manifest";

/**
 * Translate the shared composer form (total amount + total duration in days)
 * into the contract's per-interval vesting model: a daily linear release of
 * total / duration per day, honouring each asset's divisibility. GAS allows a
 * fractional per-day rate; NEO is indivisible and collapses sub-1-NEO/day
 * schedules into a single interval spanning the full duration.
 */
function deriveSchedule(
  amount: string,
  durationDays: string,
  asset: "NEO" | "GAS",
): { rate: string; intervalDays: string } {
  const total = Number.parseFloat(amount);
  const days = Number.parseInt(durationDays, 10);
  if (!Number.isFinite(total) || !Number.isFinite(days) || days <= 0) {
    return { rate: amount, intervalDays: "1" };
  }

  if (asset === "NEO") {
    const totalNeo = Math.trunc(total);
    const perDay = Math.trunc(totalNeo / days);
    if (perDay >= 1) {
      return { rate: String(perDay), intervalDays: "1" };
    }
    return { rate: String(totalNeo), intervalDays: String(days) };
  }

  const perDay = total / days;
  return { rate: String(perDay), intervalDays: "1" };
}

defineMiniApp({
  appId: "miniapp-neo-pay-shared-example",
  playArea: PlayArea,
  manifest,
  messages: neoPayMessages,

  setup(ctx) {
    const pay = useNeoPayApp({
      chain: ctx.services.chain,
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

      await ctx.services.notify.guard(
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
        "streamCreated",
      );
    });

    ctx.registerAction("cancelStream", async (...args: unknown[]) => {
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
      await ctx.services.notify.guard(
        () => pay.cancelStream(stream),
        "streamCancelled",
      );
    });

    ctx.registerAction("claimStream", async (...args: unknown[]) => {
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
