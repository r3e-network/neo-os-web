/**
 * Neo Pay — React Entry Point
 *
 * Wires the streams/vesting composable to the app's OWN standalone on-chain
 * contract (MiniAppNeoPay) via ctx.services.chain — supports NEO + GAS.
 */

import { defineMiniApp } from "@shared/react/defineMiniApp";
import PlayArea from "./PlayArea";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import { useNeoPayApp } from "./composables/useNeoPayApp";

/**
 * Translate the PlayArea form (total amount + total duration in days) into the
 * contract's per-interval vesting model: a daily linear release of
 * total / duration per day. Returns the rate string and interval-days string
 * the composable expects, honouring each asset's divisibility:
 *
 *  - GAS is divisible to 8 dp, so a fractional per-day rate is always valid.
 *  - NEO is indivisible. If total / duration truncates to < 1 NEO/day, a daily
 *    rate of 0 would be rejected, so we collapse the schedule into a single
 *    interval that spans the whole duration and releases the full total at the
 *    end (rate = total, intervalDays = duration). When total >= duration, the
 *    per-day integer NEO rate is used.
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
    // Sub-1-NEO/day: release everything in one interval at the horizon.
    return { rate: String(totalNeo), intervalDays: String(days) };
  }

  // GAS: linear per-day release; the composable scales by 1e8.
  const perDay = total / days;
  return { rate: String(perDay), intervalDays: "1" };
}

defineMiniApp({
  appId: "miniapp-neo-pay",
  playArea: PlayArea,
  manifest,
  messages,

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
        notes?: string;
      };
      const recipient = String(form.recipient ?? "").trim();
      const amount = String(form.amount ?? "").trim();
      const durationDays = String(form.duration ?? "").trim();
      const token =
        String(form.token ?? "GAS").trim().toUpperCase() === "NEO"
          ? "NEO"
          : "GAS";
      const { rate, intervalDays } = deriveSchedule(amount, durationDays, token);

      await ctx.services.notify.guard(
        () =>
          pay.handleCreateVault({
            name: `Stream to ${recipient.slice(0, 8)}...`,
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
        // composable doesn't track isCreating separately — surface isLoading + isRefreshing
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
