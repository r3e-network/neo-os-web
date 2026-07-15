/**
 * Unbreakable Vault — Entry Point (React)
 */

import { defineMiniApp, createObservable, refsToObservables } from "@shared/react";
import PlayArea from "./PlayArea";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import { useVaultBreaker } from "./composables/useVaultBreaker";
import { useVaultCreator } from "./composables/useVaultCreator";
import {
  createVaultSafety,
  probeVaultChainContext,
  requireCanonicalVaultContext,
  requireWritableVaultContext,
} from "./composables/vaultSafety";

defineMiniApp({
  appId: "miniapp-unbreakablevault",
  playArea: PlayArea,
  manifest,
  messages,

  setup(ctx) {
    const t = ctx.t as (key: string) => string;
    const safety = createVaultSafety(ctx.framework, t);
    const networkName = createObservable(String(ctx.framework.platform.launch.network ?? ""));
    // Tri-state, not a boolean: "probing" is the honest first-paint value. A
    // plain `false` made the pre-probe surface indistinguishable from a real
    // contract mismatch, so the vault declared itself locked before it had
    // asked the network anything.
    const chainStatus = createObservable<
      "probing" | "ready" | "mismatch" | "awaiting-context"
    >("probing");
    const chainReady = createObservable(false);
    const writeStatus = createObservable<"probing" | "ready" | "blocked">("probing");
    const writeReady = createObservable(false);
    const writeBlockReason = createObservable("");

    const creator = useVaultCreator({
      app: ctx.framework,
      t,
      safety,
    });

    const breaker = useVaultBreaker({
      app: ctx.framework,
      t,
      safety,
    });

    const refreshContext = async () => {
      // Classify first so the surface can tell "nothing handed to us yet" apart
      // from "this network is bound to the wrong contract". The hard gate below
      // still runs and still rejects both.
      const probe = await probeVaultChainContext(ctx.framework);
      if (probe.status === "awaiting-context") {
        chainStatus.set("awaiting-context");
        chainReady.set(false);
        writeStatus.set("blocked");
        writeReady.set(false);
        writeBlockReason.set("");
        return false;
      }
      try {
        const context = await requireCanonicalVaultContext(
          ctx.framework,
          t("chainContextMismatch"),
        );
        networkName.set(context.network);
        chainStatus.set("ready");
        chainReady.set(true);
        try {
          await requireWritableVaultContext(ctx.framework, t);
          writeStatus.set("ready");
          writeReady.set(true);
          writeBlockReason.set("");
        } catch (error) {
          writeStatus.set("blocked");
          writeReady.set(false);
          writeBlockReason.set(
            ctx.framework.errors.messageOf(error, t("writeUnavailable")),
          );
        }
        return true;
      } catch {
        chainStatus.set("mismatch");
        chainReady.set(false);
        writeStatus.set("blocked");
        writeReady.set(false);
        writeBlockReason.set(t("chainContextMismatch"));
        return false;
      }
    };

    ctx.framework.actions.register("loadVault", async (vaultId: unknown) => {
      const result = vaultId
        ? await breaker.selectVault(String(vaultId))
        : await breaker.loadVault();
      if (result?.error) {
        ctx.setStatus(result.error, "error");
      }
    });

    ctx.framework.actions.register("attemptBreak", async (payload: unknown) => {
      const receiptId = payload && typeof payload === "object"
        ? String((payload as { receiptId?: unknown }).receiptId ?? "")
        : "";
      const result = await breaker.attemptBreak(receiptId);
      if (!result) return; // guard not satisfied — no attempt was made
      if (result.status === "pending") {
        ctx.setStatus(t("vaultAttemptConfirming"), "warning");
      } else if (result.broken) {
        ctx.setStatus(t("broken"), "success");
      } else {
        ctx.setStatus(t("vaultAttemptFailed"), "warning");
      }
    });

    ctx.framework.actions.register("settleVault", async () => {
      const result = await breaker.settleVault();
      if (!result) return; // guard not satisfied — creator-of-expired only
      if (result.status === "confirmed") {
        ctx.setStatus(t("vaultReclaimed"), "success");
      } else {
        ctx.setStatus(t("transactionPending"), "warning");
      }
    });

    ctx.framework.actions.register("createVault", async (form: unknown) => {
      const result = await creator.createVault(
        form as Parameters<typeof creator.createVault>[0],
        (vaultId: string) => {
          ctx.setStatus(t("vaultCreated"), "success");
          void breaker.selectVault(vaultId);
        },
        breaker.loadRecentVaults,
      );
      if (result?.status === "pending") {
        ctx.setStatus(t("transactionPending"), "warning");
      }
    });

    ctx.framework.actions.register("increaseBounty", async (payload: unknown) => {
      const input = payload && typeof payload === "object"
        ? payload as { vaultId?: unknown; amountGas?: unknown; receiptId?: unknown }
        : {};
      const amountGas = String(input.amountGas ?? "");
      const result = await creator.increaseBounty(
        String(input.vaultId ?? ""),
        amountGas,
        String(input.receiptId ?? ""),
        () => breaker.loadVault().then(() => undefined),
      );
      if (result?.status === "confirmed") {
        ctx.setStatus(
          t("increaseBountySuccess")
            .replace("{amount}", amountGas)
            .replace("{tokenGas}", t("tokenGas")),
          "success",
        );
      } else if (result?.status === "pending") {
        ctx.setStatus(t("transactionPending"), "warning");
      }
    });

    ctx.framework.actions.register("recoverPendingVault", async () => {
      const result = await safety.recover(breaker.attemptSecret.get());
      if (result.status === "none") return;
      if (result.status === "fault") {
        ctx.setStatus(t("transactionFaulted"), "error");
        return;
      }
      if (result.status === "pending") {
        ctx.setStatus(
          result.needsSecret ? t("recoverySecretRequired") : t("transactionPending"),
          "warning",
        );
        return;
      }
      const { pending, vaultId } = result.finalization;
      if (pending.kind === "create") creator.createdVaultId.set(vaultId);
      if (pending.kind === "attempt") breaker.attemptSecret.set("");
      await breaker.selectVault(vaultId);
      await Promise.all([breaker.loadRecentVaults(), creator.loadMyVaults()]);
      if (pending.kind === "attempt") {
        ctx.setStatus(result.finalization.broken ? t("broken") : t("vaultAttemptFailed"), result.finalization.broken ? "success" : "warning");
      } else if (pending.kind === "reclaim") {
        ctx.setStatus(t("vaultReclaimed"), "success");
      } else if (pending.kind === "increase") {
        ctx.setStatus(t("bountyIncreaseRecovered"), "success");
      } else {
        ctx.setStatus(t("vaultCreated"), "success");
      }
    });

    ctx.framework.actions.register("refreshVaultRecoveryStorage", async () => {
      const restored = safety.refreshRecoveryStorage();
      ctx.setStatus(
        restored ? t("recoveryJournalRestored") : t("recoveryStorageRestored"),
        restored ? "warning" : "success",
      );
    });

    const myVaultCount = {
      get: () => creator.myVaults.get().length,
      set: () => {},
      subscribe: (fn: () => void) => creator.myVaults.subscribe(fn),
    };
    const recentVaultCount = {
      get: () => breaker.recentVaults.get().length,
      set: () => {},
      subscribe: (fn: () => void) => breaker.recentVaults.subscribe(fn),
    };

    return {
      state: refsToObservables({
        address: ctx.framework.chain.address,
        myVaultCount,
        recentVaultCount,
        vaultDifficulty: createObservable("1"),
        // expose break-flow inputs so PlayArea can wire them
        vaultIdInput: breaker.vaultIdInput,
        attemptSecret: breaker.attemptSecret,
        attemptFeeDisplay: breaker.attemptFeeDisplay,
        createdVaultId: creator.createdVaultId,
        vaultDetails: breaker.vaultDetails,
        recentVaults: breaker.recentVaults,
        myVaults: creator.myVaults,
        isLoading: breaker.isLoading,
        isCreating: creator.isCreating,
        isClaiming: breaker.isClaiming,
        canAttempt: breaker.canAttempt,
        canReclaim: breaker.canReclaim,
        pendingOperation: safety.pendingOperation,
        recoveryStorageHealthy: safety.recoveryStorageHealthy,
        isRecovering: safety.isRecovering,
        catalogReadError: breaker.catalogReadError,
        myVaultsReadError: creator.myVaultsReadError,
        networkName,
        chainStatus,
        chainReady,
        writeStatus,
        writeReady,
        writeBlockReason,
      }),
      loadData: async () => {
        const ready = await refreshContext();
        if (!ready) return;
        await Promise.all([breaker.loadRecentVaults(), creator.loadMyVaults()]);
      },
    };
  },
});
