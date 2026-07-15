import { defineMiniApp } from "@shared/react/defineMiniApp";
import { createDerived, createObservable } from "@shared/react/context";
import {
  canClaim,
  deriveSchedule,
  isFinalizedStatus,
  useNeoPayApp,
} from "@shared/composables/neo-pay";
import PlayArea from "./PlayArea";
import { manifest } from "./manifest";
import { messages } from "./messages";
import {
  classifyNeoPayBinding,
  validateStreamDraft,
  type StudioAsset,
  type StudioServiceState,
} from "./stream-studio";

defineMiniApp({
  appId: "miniapp-neo-pay-shared-example",
  playArea: PlayArea,
  manifest,
  messages,

  setup(ctx) {
    const app = ctx.framework;
    const pay = useNeoPayApp({ app, t: ctx.t });
    const network = createObservable(String(app.platform.launch.network ?? ""));
    const contractHash = app.chain.contractAddress;
    const chainBindingState = createDerived(
      () => classifyNeoPayBinding(network.get(), contractHash.get()),
      [network, contractHash],
    );
    const serviceState = createDerived<StudioServiceState>(
      () => {
        // No network/contract yet is the pre-wallet state, not a dead service.
        if (chainBindingState.get() === "awaiting-context") return "disconnected";
        if (chainBindingState.get() !== "verified") return "unavailable";
        if (pay.pendingCreateTxid.get()) return "pending";
        if (pay.isLoading.get() || pay.isRefreshing.get()) return "loading";
        if (!app.chain.address.get()) return "disconnected";
        if (pay.dataState.get() === "unavailable") return "unavailable";
        if (pay.dataState.get() === "partial") return "partial";
        return pay.dataState.get() === "live" ? "live" : "loading";
      },
      [
        chainBindingState,
        pay.pendingCreateTxid,
        pay.isLoading,
        pay.isRefreshing,
        pay.dataState,
        app.chain.address,
      ],
    );

    const requireCanonicalBinding = () => {
      if (chainBindingState.get() !== "verified") {
        throw new Error(ctx.t("bindingMismatch"));
      }
    };

    const rejectBusyOrPending = (): boolean => {
      if (pay.isCreating.get() || pay.claimingId.get() || pay.cancellingId.get()) {
        ctx.setStatus(ctx.t("studioBusy"), "warning");
        return true;
      }
      if (pay.pendingCreateTxid.get()) {
        ctx.setStatus(ctx.t("streamConfirmationPending"), "warning");
        return true;
      }
      return false;
    };

    app.actions.register("createStream", async (...args: unknown[]) => {
      if (rejectBusyOrPending()) return;
      const form = (args[0] ?? {}) as {
        recipient?: string;
        amount?: string;
        duration?: string;
        token?: string;
        notes?: string;
      };
      const recipient = String(form.recipient ?? "").trim();
      const amount = String(form.amount ?? "").trim();
      const duration = String(form.duration ?? "").trim();
      const asset: StudioAsset = String(form.token ?? "GAS").toUpperCase() === "NEO" ? "NEO" : "GAS";
      const validation = validateStreamDraft({ recipient, amount, duration, asset });
      if (!validation.valid) {
        const issue = !validation.recipientValid
          ? validation.recipientIssue
          : !validation.amountValid
            ? validation.amountIssue
            : validation.durationIssue;
        ctx.setStatus(ctx.t(issue), "error");
        return;
      }

      try {
        requireCanonicalBinding();
      } catch (error) {
        app.notify.error(error, "bindingMismatch");
        return;
      }

      const { rate, intervalDays } = deriveSchedule(amount, duration, asset);
      await app.notify.guard(
        () => pay.handleCreateVault({
          name: ctx.t("defaultStreamTitle", { address: recipient.slice(0, 8) }),
          beneficiary: recipient,
          asset,
          total: amount,
          rate,
          intervalDays,
          notes: String(form.notes ?? ""),
        }),
        { successKey: "streamCreated" },
      );
    });

    app.actions.register("claimStream", async (...args: unknown[]) => {
      if (rejectBusyOrPending()) return;
      const input = (args[0] ?? {}) as { streamId?: string } | string;
      const id = typeof input === "string" ? input : String(input.streamId ?? "");
      const stream = pay.beneficiaryStreams.get().find((item) => item.id === id) ?? null;
      if (!stream || !canClaim(stream.status, stream.claimable > 0n)) {
        ctx.setStatus(ctx.t("streamNotFound"), "error");
        return;
      }
      try {
        requireCanonicalBinding();
      } catch (error) {
        app.notify.error(error, "bindingMismatch");
        return;
      }
      await app.notify.guard(
        () => pay.claimStream(stream),
        { successKey: "streamClaimed" },
      );
    });

    app.actions.register("cancelStream", async (...args: unknown[]) => {
      if (rejectBusyOrPending()) return;
      const input = (args[0] ?? {}) as { streamId?: string } | string;
      const id = typeof input === "string" ? input : String(input.streamId ?? "");
      const stream = pay.createdStreams.get().find((item) => item.id === id) ?? null;
      if (!stream || isFinalizedStatus(stream.status)) {
        ctx.setStatus(ctx.t("streamNotFound"), "error");
        return;
      }
      try {
        requireCanonicalBinding();
      } catch (error) {
        app.notify.error(error, "bindingMismatch");
        return;
      }
      await app.notify.guard(
        () => pay.cancelStream(stream),
        { successKey: "streamCancelled" },
      );
    });

    // Both controls are read-only recovery paths. They re-read authoritative
    // stream state and never resubmit the atomic funding transaction.
    app.actions.register("refreshStreams", pay.loadAll);
    app.actions.register("recoverPendingCreate", async () => {
      try {
        requireCanonicalBinding();
        await pay.loadAll();
      } catch (error) {
        app.notify.error(error, "bindingMismatch");
      }
    });

    return {
      state: {
        network,
        contractHash,
        chainBindingState,
        serviceState,
        createdStreams: pay.createdStreams,
        beneficiaryStreams: pay.beneficiaryStreams,
        isLoading: pay.isLoading,
        isCreating: pay.isCreating,
        isRefreshing: pay.isRefreshing,
        claimingId: pay.claimingId,
        cancellingId: pay.cancellingId,
        serviceNotice: pay.serviceNotice,
        dataState: pay.dataState,
        failedDetailReads: pay.failedDetailReads,
        pendingCreateTxid: pay.pendingCreateTxid,
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
