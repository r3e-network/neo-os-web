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
import { deriveSchedule } from "./composables/deriveSchedule";

defineMiniApp({
  appId: "miniapp-neo-pay",
  playArea: PlayArea,
  manifest,
  messages,

  setup(ctx) {
    const pay = useNeoPayApp({
      app: ctx.framework,
      // chain retained solely for readArray (no framework equivalent).
      chain: ctx.services.chain,
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

    ctx.framework.actions.register("cancelStream", async (...args: unknown[]) => {
      const input = (args[0] ?? {}) as { streamId?: string } | string;
      const id =
        typeof input === "string"
          ? input
          : String(input.streamId ?? "");
      const stream = findStreamById(id);
      if (!stream) {
        ctx.setStatus(ctx.t("streamNotFound"), "error");
        return;
      }
      await ctx.services.notify.guard(
        () => pay.cancelStream(stream),
        "streamCancelled",
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
        ctx.setStatus(ctx.t("streamNotFound"), "error");
        return;
      }
      await ctx.services.notify.guard(
        () => pay.claimStream(stream),
        "streamClaimed",
      );
    });

    ctx.framework.actions.register("refreshStreams", async () => {
      await pay.refreshStreams();
    });

    return {
      state: {
        createdStreams: pay.createdStreams,
        beneficiaryStreams: pay.beneficiaryStreams,
        isLoading: pay.isLoading,
        // isCreating is its own observable (set only during the create flow) so
        // the submit button spins without the created/incoming lists flashing to
        // their loading state; isLoading/isRefreshing drive the list spinners.
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
