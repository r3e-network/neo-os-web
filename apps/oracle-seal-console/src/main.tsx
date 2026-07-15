import { defineMiniApp } from "@shared/react/defineMiniApp";
import { createObservable } from "@shared/react/context";
import { FrameworkSealError, type FrameworkSealPublicKey } from "@framework/oracle-ext";
import PlayArea from "./PlayArea";
import { appId, configuredNetwork, manifest, messages } from "./appConfig";
import {
  appendStoredOracleSeal,
  assertOracleSealStorageAvailable,
  clearPendingOracleSeal,
  inspectPendingOracleSeal,
  markPendingOracleSealStored,
  pendingOracleSealState,
  readStoredOracleSeals,
  savePendingOracleSeal,
  type PendingOracleSeal,
  type StoredOracleSealRecord,
} from "./history";
import {
  readOracleSealContractEvidence,
  readOracleSealStoreCapability,
} from "./oracle-seal-chain";
import {
  createOracleSealOperationCoordinator,
  OracleSealOperationConflictError,
} from "./operation-coordinator";
import {
  assertOracleContractEvidence,
  expectedOracleContract,
  normalizeOracleSealError,
  prepareOracleSeal,
  storePreparedOracleSeal,
  type OracleSealErrorKey,
  type OracleSealPhase,
  type StoredOracleSealReceipt,
} from "./seal";

const network = configuredNetwork();

defineMiniApp({
  appId,
  playArea: PlayArea,
  manifest,
  messages,
  oracle: { seal: { network } },
  setup(ctx) {
    const app = ctx.framework;
    const networkLabel = createObservable(
      network === "mainnet" ? ctx.t("networkMainnet") : ctx.t("networkTestnet"),
    );
    const runtimeState = createObservable<"checking" | "ready" | "unavailable">("checking");
    const runtimeStateLabel = createObservable(ctx.t("runtimeChecking"));
    const phase = createObservable<
      "checking" | "draft" | OracleSealPhase | "stored" | "recovery" | "blocked"
    >("checking");
    const lastStatus = createObservable(ctx.t("statusCheckingRuntime"));
    const lastFingerprint = createObservable(ctx.t("fingerprintEmpty"));
    const lastSecretRef = createObservable("");
    const lastContract = createObservable("");
    const lastAlgorithm = createObservable("");
    const lastStoredAt = createObservable(0);
    const sealCount = createObservable(0);
    const isBusy = createObservable(false);
    const storageReady = createObservable(false);
    const hasPending = createObservable(false);
    const pendingStored = createObservable(false);
    const pendingMalformed = createObservable(false);
    const pendingFingerprint = createObservable("");
    const pendingSecretRef = createObservable("");
    const pendingAttempts = createObservable(0);
    const pendingCreatedAt = createObservable(0);
    const pendingPurpose = createObservable("");
    const pendingPublicRoute = createObservable("");
    const keyContract = createObservable("");
    const keyCheckedAt = createObservable(0);
    const operations = createOracleSealOperationCoordinator((busy) => isBusy.set(busy));
    let sessionPending: PendingOracleSeal | null = null;

    const localizeError = (error: unknown): { key: OracleSealErrorKey; message: string } => {
      const key = normalizeOracleSealError(error);
      switch (key) {
        case "sealErrorInput": return { key, message: ctx.t("sealErrorInput") };
        case "sealErrorTooLarge": return { key, message: ctx.t("sealErrorTooLarge") };
        case "sealErrorKey": return { key, message: ctx.t("sealErrorKey") };
        case "sealErrorAlgorithm": return { key, message: ctx.t("sealErrorAlgorithm") };
        case "sealErrorEncrypt": return { key, message: ctx.t("sealErrorEncrypt") };
        case "sealErrorService": return { key, message: ctx.t("sealErrorService") };
        case "sealErrorStore": return { key, message: ctx.t("sealErrorStore") };
        case "sealErrorStorage": return { key, message: ctx.t("sealErrorStorage") };
        case "sealErrorTimeout": return { key, message: ctx.t("sealErrorTimeout") };
        default: return { key: "sealErrorGeneric", message: ctx.t("sealErrorGeneric") };
      }
    };

    const runOperation = async <T,>(
      key: string,
      task: () => Promise<T>,
      joinSame = false,
    ): Promise<T> => {
      try {
        return await operations.run(key, task, { joinSame });
      } catch (error) {
        if (error instanceof OracleSealOperationConflictError) {
          throw new Error(ctx.t("operationInProgress"));
        }
        throw error;
      }
    };

    const syncPending = (
      pending: PendingOracleSeal | null,
      malformed = false,
    ) => {
      const stored = pending ? pendingOracleSealState(pending) === "stored" : false;
      sessionPending = pending;
      hasPending.set(Boolean(pending) || malformed);
      pendingStored.set(stored);
      pendingMalformed.set(malformed);
      pendingFingerprint.set(pending?.fingerprint ?? "");
      pendingSecretRef.set(pending?.storedReceipt?.secretRef ?? "");
      pendingAttempts.set(pending?.attempts ?? 0);
      pendingCreatedAt.set(pending?.createdAt ?? 0);
      pendingPurpose.set(pending?.purpose ?? "");
      pendingPublicRoute.set(pending?.publicRoute ?? "");
      if (pending || malformed) {
        runtimeStateLabel.set(ctx.t(
          malformed
            ? "runtimeRecoveryInvalid"
            : stored ? "runtimeCompletion" : "runtimeRecovery",
        ));
        phase.set("recovery");
        lastStatus.set(ctx.t(
          malformed
            ? "statusRecoveryInvalid"
            : stored ? "statusCompletionReady" : "statusRecoveryReady",
        ));
      }
    };

    const applyReceipt = (
      receipt: StoredOracleSealReceipt,
      storedAt: number,
      count?: number,
    ) => {
      if (count !== undefined) sealCount.set(count);
      lastFingerprint.set(receipt.fingerprint);
      lastSecretRef.set(receipt.secretRef);
      lastContract.set(receipt.contract);
      lastAlgorithm.set(receipt.algorithm);
      lastStoredAt.set(storedAt);
    };

    const syncHistory = (): StoredOracleSealRecord[] => {
      const receipts = readStoredOracleSeals(app.storage.local);
      sealCount.set(receipts.length);
      const latest = receipts[0];
      if (latest) {
        applyReceipt(latest, latest.storedAt, receipts.length);
      } else {
        lastFingerprint.set(ctx.t("fingerprintEmpty"));
        lastSecretRef.set("");
        lastContract.set("");
        lastAlgorithm.set("");
        lastStoredAt.set(0);
      }
      return receipts;
    };

    const completeStored = (
      prepared: PendingOracleSeal,
      receipt: StoredOracleSealReceipt,
    ) => {
      const storedAt = Date.now();
      const settled = markPendingOracleSealStored(prepared, receipt, storedAt);
      let markerSaved = false;
      let receiptSaved = false;
      let pendingCleared = false;

      try {
        savePendingOracleSeal(app.storage.local, settled);
        markerSaved = true;
      } catch {
        // If storage filled between the prepared write and the store response,
        // removing the prepared journal is safer than offering a duplicate POST.
        try {
          clearPendingOracleSeal(app.storage.local);
          pendingCleared = true;
        } catch {
          // Keep an in-memory stored marker below; no second POST is issued in
          // this session even when device storage becomes unavailable.
        }
      }

      try {
        const receipts = appendStoredOracleSeal(app.storage.local, { ...receipt, storedAt });
        receiptSaved = true;
        applyReceipt(receipt, storedAt, receipts.length);
      } catch {
        applyReceipt(receipt, storedAt);
      }

      if (!pendingCleared) {
        try {
          clearPendingOracleSeal(app.storage.local);
          pendingCleared = true;
        } catch {
          // The stored marker, when durable, turns the next primary action into
          // local finalization rather than a second confidential-store request.
        }
      }

      runtimeStateLabel.set(ctx.t("runtimeReady"));
      phase.set("stored");
      if (pendingCleared) {
        syncPending(null);
        const message = receiptSaved ? ctx.t("statusStored") : ctx.t("statusReceiptLocalWarning");
        lastStatus.set(message);
        ctx.setStatus(message, receiptSaved ? "success" : "warning");
        return;
      }

      syncPending(settled);
      lastStatus.set(ctx.t("statusCompletionReady"));
      ctx.setStatus(
        markerSaved ? ctx.t("statusCompletionReady") : ctx.t("statusStorageCritical"),
        "warning",
      );
    };

    const verifyFreshKey = async (key: FrameworkSealPublicKey) => {
      if (key.contract.toLowerCase() !== expectedOracleContract(network)) {
        throw new FrameworkSealError("key", "Oracle contract mismatch");
      }
      try {
        const evidence = await readOracleSealContractEvidence(network);
        assertOracleContractEvidence(key, evidence.publicKey, evidence.algorithm, network);
        if (evidence.contract !== key.contract.toLowerCase()) {
          throw new FrameworkSealError("key", "Oracle contract evidence mismatch");
        }
        keyContract.set(evidence.contract);
        keyCheckedAt.set(evidence.checkedAt);
      } catch (error) {
        throw error instanceof FrameworkSealError
          ? error
          : new FrameworkSealError("key", error);
      }
    };

    /**
     * @param passive True for the probe `loadData` fires on open, where the
     * visitor has asked for nothing. A passive failure is just "we have not
     * reached the key yet" and must read that way; only an explicit
     * "Check service" click has earned a diagnosis.
     */
    const refreshRuntimeInternal = async (passive = false): Promise<boolean> => {
      runtimeState.set("checking");
      storageReady.set(false);
      runtimeStateLabel.set(hasPending.get() ? runtimeStateLabel.get() : ctx.t("runtimeChecking"));
      keyContract.set("");
      keyCheckedAt.set(0);
      phase.set(hasPending.get() ? "recovery" : "checking");
      if (!hasPending.get()) lastStatus.set(ctx.t("statusCheckingRuntime"));
      try {
        assertOracleSealStorageAvailable(app.storage.local);
        storageReady.set(true);
        const [key] = await Promise.all([
          app.oracle.seal.publicKey({ forceRefresh: true }),
          readOracleSealStoreCapability(network),
        ]);
        await verifyFreshKey(key);
        runtimeState.set("ready");
        if (hasPending.get()) {
          runtimeStateLabel.set(ctx.t(
            pendingMalformed.get()
              ? "runtimeRecoveryInvalid"
              : pendingStored.get() ? "runtimeCompletion" : "runtimeRecovery",
          ));
          phase.set("recovery");
        } else {
          runtimeStateLabel.set(ctx.t("runtimeReady"));
          phase.set("draft");
          lastStatus.set(ctx.t("statusRuntimeReady"));
        }
        return true;
      } catch (error) {
        runtimeState.set("unavailable");
        runtimeStateLabel.set(hasPending.get() ? runtimeStateLabel.get() : ctx.t("runtimeUnavailable"));
        phase.set(hasPending.get() ? "recovery" : "blocked");
        const localized = localizeError(error);
        // A failed availability check is not a failed seal: keep specific
        // diagnoses (storage, algorithm, key) but never a seal-outcome message.
        // On the passive open-probe the visitor has attempted nothing at all, so
        // even a specific diagnosis is the wrong register — "could not be
        // verified" reads as a fault the visitor caused, on a console they have
        // not touched. The probe simply has not reached the key yet; say that,
        // and let the explicit Check service button report the diagnosis.
        const message = passive
          ? ctx.t("statusRuntimeUnverified")
          : localized.key === "sealErrorGeneric" || localized.key === "sealErrorEncrypt"
            ? ctx.t("statusRuntimeUnverified")
            : localized.message;
        if (!hasPending.get()) lastStatus.set(message);
        return false;
      }
    };

    app.actions.register("refreshRuntime", async () => {
      const ready = await runOperation("refresh", refreshRuntimeInternal, true);
      ctx.setStatus(
        ready ? ctx.t("statusRuntimeReady") : lastStatus.get(),
        ready ? "success" : "error",
      );
    });

    app.actions.register("sealPayload", async (input: unknown) => runOperation("seal", async () => {
      if (hasPending.get()) throw new Error(ctx.t("pendingMustResolve"));
      const draft = input && typeof input === "object"
        ? input as Record<string, unknown>
        : {};
      if (runtimeState.get() !== "ready" && !(await refreshRuntimeInternal())) {
        throw new Error(lastStatus.get() || ctx.t("statusRuntimeUnavailable"));
      }

      try {
        assertOracleSealStorageAvailable(app.storage.local);
        const receipt = await prepareOracleSeal({
          appId,
          network,
          purpose: String(draft.purpose || ""),
          publicRoute: String(draft.publicRoute || ""),
          payload: String(draft.payload || ""),
          seal: app.oracle.seal,
          verifyKey: verifyFreshKey,
          onPhase: (next) => {
            phase.set(next);
            lastStatus.set(next === "key"
              ? ctx.t("statusKey")
              : next === "encrypt" ? ctx.t("statusEncrypt") : ctx.t("statusStore"));
          },
          onPrepared: (prepared) => {
            const pending = savePendingOracleSeal(app.storage.local, {
              version: 2,
              recoveryState: "prepared",
              ...prepared,
              createdAt: Date.now(),
              attempts: 1,
            });
            syncPending(pending);
            phase.set("store");
            lastStatus.set(ctx.t("statusStore"));
          },
        });
        const pending = inspectPendingOracleSeal(app.storage.local).pending;
        if (!pending) {
          throw new Error(ctx.t("sealErrorStorage"));
        }
        completeStored(pending, receipt);
        return receipt;
      } catch (error) {
        const localized = localizeError(error);
        const inspection = inspectPendingOracleSeal(app.storage.local);
        if (inspection.pending) {
          try {
            const saved = savePendingOracleSeal(app.storage.local, {
              ...inspection.pending,
              lastError: localized.key,
            });
            syncPending(saved);
          } catch {
            syncPending(inspection.pending);
          }
        } else if (inspection.malformed) {
          syncPending(null, true);
        } else {
          phase.set(runtimeState.get() === "ready" ? "draft" : "blocked");
        }
        lastStatus.set(localized.message);
        ctx.setStatus(localized.message, "error");
        throw new Error(localized.message);
      }
    }));

    app.actions.register("retryPending", async () => runOperation("recovery", async () => {
      const inspection = inspectPendingOracleSeal(app.storage.local);
      if (inspection.malformed && !sessionPending) throw new Error(ctx.t("statusRecoveryInvalid"));
      const pending = sessionPending ?? inspection.pending;
      if (!pending) throw new Error(ctx.t("pendingMissing"));
      if (
        pending.network !== network
        || pending.contract.toLowerCase() !== expectedOracleContract(network)
      ) {
        lastStatus.set(ctx.t("pendingWrongNetwork"));
        throw new Error(ctx.t("pendingWrongNetwork"));
      }

      if (pendingOracleSealState(pending) === "stored" && pending.storedReceipt) {
        try {
          const storedAt = pending.storedAt ?? Date.now();
          const receipts = appendStoredOracleSeal(app.storage.local, {
            ...pending.storedReceipt,
            storedAt,
          });
          clearPendingOracleSeal(app.storage.local);
          syncPending(null);
          applyReceipt(pending.storedReceipt, storedAt, receipts.length);
          runtimeStateLabel.set(
            runtimeState.get() === "ready" ? ctx.t("runtimeReady") : ctx.t("runtimeUnavailable"),
          );
          phase.set("stored");
          lastStatus.set(ctx.t("statusStored"));
          ctx.setStatus(ctx.t("statusStored"), "success");
          return pending.storedReceipt;
        } catch (error) {
          syncPending(pending);
          const localized = localizeError(error);
          lastStatus.set(ctx.t("statusCompletionReady"));
          ctx.setStatus(localized.message, "warning");
          throw new Error(localized.message);
        }
      }

      phase.set("store");
      lastStatus.set(ctx.t("statusRetrying"));
      try {
        // Recovery deliberately skips publicKey()/encrypt(): storage receives
        // the byte-identical packet persisted before the first store attempt.
        const receipt = await storePreparedOracleSeal({
          appId,
          prepared: pending,
          seal: app.oracle.seal,
        });
        completeStored(pending, receipt);
        return receipt;
      } catch (error) {
        const localized = localizeError(error);
        const updated = {
          ...pending,
          attempts: pending.attempts + 1,
          lastError: localized.key,
        } satisfies PendingOracleSeal;
        try {
          syncPending(savePendingOracleSeal(app.storage.local, updated));
        } catch {
          syncPending(updated);
        }
        lastStatus.set(localized.message);
        ctx.setStatus(localized.message, "error");
        throw new Error(localized.message);
      }
    }));

    app.actions.register("discardPending", async () => runOperation("discard", async () => {
      try {
        clearPendingOracleSeal(app.storage.local);
        syncPending(null);
        runtimeStateLabel.set(
          runtimeState.get() === "ready" ? ctx.t("runtimeReady") : ctx.t("runtimeUnavailable"),
        );
        phase.set(runtimeState.get() === "ready" ? "draft" : "blocked");
        lastStatus.set(ctx.t("statusDiscarded"));
        ctx.setStatus(ctx.t("statusDiscarded"), "info");
      } catch (error) {
        const localized = localizeError(error);
        lastStatus.set(localized.message);
        ctx.setStatus(localized.message, "error");
        throw new Error(localized.message);
      }
    }));

    return {
      state: {
        networkLabel,
        runtimeState,
        runtimeStateLabel,
        phase,
        lastStatus,
        lastFingerprint,
        lastSecretRef,
        lastContract,
        lastAlgorithm,
        lastStoredAt,
        sealCount,
        isBusy,
        storageReady,
        hasPending,
        pendingStored,
        pendingMalformed,
        pendingFingerprint,
        pendingSecretRef,
        pendingAttempts,
        pendingCreatedAt,
        pendingPurpose,
        pendingPublicRoute,
        keyContract,
        keyCheckedAt,
      },
      loadData: async () => {
        syncHistory();
        const inspection = inspectPendingOracleSeal(app.storage.local);
        syncPending(inspection.pending, inspection.malformed);
        // Passive: this fires on open, before the visitor has asked for anything.
        await runOperation("refresh", () => refreshRuntimeInternal(true), true);
      },
    };
  },
});
