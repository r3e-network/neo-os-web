import { defineMiniApp } from "@shared/react/defineMiniApp";
import { createObservable } from "@shared/react/context";
import { FrameworkSealError } from "@framework/oracle-ext";
import PlayArea from "./PlayArea";
import { appId, manifest, messages } from "./appConfig";
import {
  appendSealedIntent,
  clearPendingSealedIntent,
  readPendingSealedIntent,
  readSealedIntents,
  savePendingSealedIntent,
  type PendingSealedIntent,
} from "./history";
import {
  assertOracleContractPublicKey,
  normalizePrivateTransferErrorKey,
  PRIVATE_TRANSFER_TESTNET_ORACLE_NEF_CHECKSUM,
  preparePrivateTransfer,
  probePrivateTransferRuntime,
  resolvePrivateTransferNetwork,
  storePreparedPrivateTransfer,
  type PrivateTransferOracleKey,
  type PreparedPrivateTransfer,
  type PreparedPrivateTransferEnvelope,
} from "./seal";

const SUPPORTED_NETWORK = "testnet";

function pendingToEnvelope(pending: PendingSealedIntent): PreparedPrivateTransferEnvelope {
  return {
    name: pending.name,
    ciphertext: pending.ciphertext,
    publicEnvelope: pending.publicEnvelope,
    commitment: pending.commitment,
    nullifier: pending.nullifier,
    network: pending.network,
    asset: pending.asset,
    contract: pending.contract,
  };
}

defineMiniApp({
  appId,
  playArea: PlayArea,
  manifest,
  messages,
  // Preserve the pre-framework sealed-intents namespace.
  storagePrefix: "miniapp-private-transfer:",
  setup(ctx) {
    const app = ctx.framework;
    const privacyMode = createObservable(ctx.t("privacyModeLabel"));
    const networkLabel = createObservable(ctx.t("networkChecking"));
    const networkState = createObservable<"checking" | "ready" | "blocked">("checking");
    // "awaiting-context": the Morpheus lane is host-proxied (/api/morpheus/*),
    // so a standalone visitor has no lane to probe. That is a normal pre-host
    // state, distinct from "unavailable" (the lane answered and is faulty).
    const oracleState = createObservable<
      "checking" | "ready" | "unavailable" | "awaiting-context"
    >("checking");
    const oracleContract = createObservable("");
    const oracleChecksum = createObservable(PRIVATE_TRANSFER_TESTNET_ORACLE_NEF_CHECKSUM);
    const oracleCheckedAt = createObservable(0);
    const storageState = createObservable<"unknown" | "storing" | "stored" | "recoverable">("unknown");
    const phase = createObservable<"checking" | "draft" | "key" | "package" | "store" | "stored" | "recovery" | "blocked">("checking");
    const lastStatus = createObservable(ctx.t("statusCheckingRuntime"));
    const lastDigest = createObservable(ctx.t("digestPlaceholder"));
    const lastSecretRef = createObservable("");
    const lastNullifier = createObservable("");
    const lastStoredAt = createObservable(0);
    const isSealing = createObservable(false);
    const requestCount = createObservable(0);
    const hasPending = createObservable(false);
    const pendingCommitment = createObservable("");
    const pendingAsset = createObservable("");
    const pendingCreatedAt = createObservable(0);
    const pendingAttempts = createObservable(0);

    const syncPending = (pending: PendingSealedIntent | null) => {
      hasPending.set(Boolean(pending));
      pendingCommitment.set(pending?.commitment ?? "");
      pendingAsset.set(pending?.asset ?? "");
      pendingCreatedAt.set(pending?.createdAt ?? 0);
      pendingAttempts.set(pending?.attempts ?? 0);
      if (pending) storageState.set("recoverable");
    };

    const syncLatestHistory = () => {
      const intents = readSealedIntents(app.storage.local);
      requestCount.set(intents.length);
      const latest = intents[0];
      if (!latest) return;
      lastDigest.set(latest.commitment);
      lastSecretRef.set(latest.secretRef);
      lastNullifier.set(latest.nullifier);
    };

    const completeStoredIntent = (sealed: PreparedPrivateTransfer) => {
      const next = appendSealedIntent(app.storage.local, {
        secretRef: sealed.secretRef,
        commitment: sealed.commitment,
        nullifier: sealed.nullifier,
        network: sealed.network,
        asset: sealed.asset,
        ts: Date.now(),
      });
      clearPendingSealedIntent(app.storage.local);
      syncPending(null);
      requestCount.set(next.length);
      lastDigest.set(sealed.commitment);
      lastSecretRef.set(sealed.secretRef);
      lastNullifier.set(sealed.nullifier);
      lastStoredAt.set(Date.now());
      storageState.set("stored");
      phase.set("stored");
      lastStatus.set(ctx.t("statusCiphertextStored"));
      ctx.setStatus(ctx.t("statusStoredToast"), "success");
    };

    const detectRuntimeNetwork = async () => resolvePrivateTransferNetwork(
      await app.chain.detectNetwork(),
      ctx.launchContext.network ?? SUPPORTED_NETWORK,
    );

    const verifyFreshOracleKey = async (key: PrivateTransferOracleKey) => {
      try {
        const [contractKey, contractAlgorithm] = await Promise.all([
          app.chain.readRaw("oracleEncryptionPublicKey", [], {
            scriptHash: key.contract,
            cache: false,
          }),
          app.chain.readRaw("oracleEncryptionAlgorithm", [], {
            scriptHash: key.contract,
            cache: false,
          }),
        ]);
        assertOracleContractPublicKey(key, contractKey, contractAlgorithm);
        oracleContract.set(key.contract);
        oracleCheckedAt.set(Date.now());
      } catch (error) {
        // Keep contract transport/read failures in the key phase so the UI
        // never mislabels them as a local encryption or storage failure.
        throw error instanceof FrameworkSealError
          ? error
          : new FrameworkSealError("key", error);
      }
    };

    const refreshRuntime = async (): Promise<boolean> => {
      networkState.set("checking");
      oracleState.set("checking");
      oracleContract.set("");
      oracleCheckedAt.set(0);
      phase.set(hasPending.get() ? "recovery" : "checking");
      lastStatus.set(ctx.t("statusCheckingRuntime"));
      try {
        const detected = await detectRuntimeNetwork();
        networkLabel.set(detected === "mainnet" ? ctx.t("networkMainnet") : detected === "testnet" ? ctx.t("networkTestnet") : ctx.t("networkUnknown"));
        if (detected !== SUPPORTED_NETWORK) {
          networkState.set("blocked");
          oracleState.set("unavailable");
          phase.set(hasPending.get() ? "recovery" : "blocked");
          lastStatus.set(ctx.t("networkTestnetOnly"));
          return false;
        }

        networkState.set("ready");

        // The Morpheus key/store endpoints are host-proxied (/api/morpheus/*).
        // Standalone there is no lane to probe: nothing has failed, so this
        // must read as "open this in the host", not "the oracle key is broken".
        if (app.platform.host === "standalone") {
          oracleState.set("awaiting-context");
          phase.set(hasPending.get() ? "recovery" : "draft");
          lastStatus.set(ctx.t("statusAwaitingHost"));
          return false;
        }

        const key = await probePrivateTransferRuntime({
          network: SUPPORTED_NETWORK,
          seal: app.oracle.seal,
        });
        await verifyFreshOracleKey(key);
        oracleState.set("ready");
        phase.set(hasPending.get() ? "recovery" : "draft");
        lastStatus.set(hasPending.get() ? ctx.t("statusRecoveryReady") : ctx.t("statusRuntimeReady"));
        return true;
      } catch (error) {
        oracleState.set("unavailable");
        phase.set(hasPending.get() ? "recovery" : "blocked");
        const message = ctx.t(normalizePrivateTransferErrorKey(error));
        lastStatus.set(message);
        return false;
      }
    };

    // Standard connect lane (RFC P1-3). Connecting inside a host re-probes the
    // confidential lane, which is what the pre-host prompt invites the visitor
    // to do instead of staring at a dead, disabled seal button.
    app.actions.registerConnectWallet({
      refresh: [async () => { await refreshRuntime(); }],
    });

    app.actions.register("refreshRuntime", async () => {
      const ready = await refreshRuntime();
      if (ready) {
        ctx.setStatus(ctx.t("statusRuntimeReady"), "success");
        return;
      }
      // Waiting for a host is not a failure — do not raise an error toast.
      if (oracleState.get() === "awaiting-context") {
        ctx.setStatus(ctx.t("statusAwaitingHost"), "info");
        return;
      }
      ctx.setStatus(ctx.t("statusRuntimeUnavailable"), "error");
    });

    app.actions.register("prepareTransfer", async (payload: unknown) => {
      if (isSealing.get()) throw new Error(ctx.t("errorOperationInProgress"));
      if (hasPending.get()) throw new Error(ctx.t("pendingMustResolve"));
      const form = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
      const recipient = String(form.recipient || "").trim();
      const amount = String(form.amount || "").trim();
      const assetInput = String(form.asset || "GAS").trim().toUpperCase();
      if (assetInput !== "GAS" && assetInput !== "NEO") {
        const message = ctx.t("errorInvalidAsset");
        ctx.setStatus(message, "error");
        throw new Error(message);
      }
      const asset = assetInput;
      const memo = String(form.memo || "").trim().slice(0, 160);

      const detected = await detectRuntimeNetwork();
      if (detected !== SUPPORTED_NETWORK) {
        networkState.set("blocked");
        oracleState.set("unavailable");
        oracleContract.set("");
        oracleCheckedAt.set(0);
        networkLabel.set(detected === "mainnet" ? ctx.t("networkMainnet") : ctx.t("networkUnknown"));
        phase.set("blocked");
        lastStatus.set(ctx.t("networkTestnetOnly"));
        throw new Error(ctx.t("networkTestnetOnly"));
      }
      if (oracleState.get() !== "ready" && !(await refreshRuntime())) {
        throw new Error(ctx.t("statusRuntimeUnavailable"));
      }

      isSealing.set(true);
      storageState.set("unknown");
      lastStatus.set(ctx.t("statusSealingShort"));
      try {
        const sealed = await preparePrivateTransfer({
          appId,
          network: SUPPORTED_NETWORK,
          recipient,
          amount,
          asset,
          memo,
          seal: app.oracle.seal,
          verifyKey: verifyFreshOracleKey,
          onPhase: (next) => {
            phase.set(next);
            if (next === "store") storageState.set("storing");
          },
          onPrepared: (prepared) => {
            const pending = savePendingSealedIntent(app.storage.local, {
              version: 1,
              ...prepared,
              createdAt: Date.now(),
              attempts: 1,
            });
            syncPending(pending);
            storageState.set("storing");
          },
        });
        completeStoredIntent(sealed);
        return sealed;
      } catch (error) {
        const key = normalizePrivateTransferErrorKey(error);
        const message = ctx.t(key);
        const pending = readPendingSealedIntent(app.storage.local);
        if (pending) {
          const updated = savePendingSealedIntent(app.storage.local, {
            ...pending,
            lastError: key,
          });
          syncPending(updated);
          phase.set("recovery");
        } else {
          phase.set("blocked");
        }
        lastStatus.set(message);
        ctx.setStatus(message, "error");
        throw new Error(message);
      } finally {
        isSealing.set(false);
      }
    });

    app.actions.register("retryPending", async () => {
      if (isSealing.get()) throw new Error(ctx.t("errorOperationInProgress"));
      const pending = readPendingSealedIntent(app.storage.local);
      if (!pending) throw new Error(ctx.t("pendingMissing"));
      const detected = await detectRuntimeNetwork();
      if (detected !== pending.network || pending.network !== SUPPORTED_NETWORK) {
        networkState.set("blocked");
        networkLabel.set(detected === "mainnet" ? ctx.t("networkMainnet") : ctx.t("networkUnknown"));
        phase.set("recovery");
        lastStatus.set(ctx.t("pendingWrongNetwork"));
        throw new Error(ctx.t("pendingWrongNetwork"));
      }
      if (!(await refreshRuntime())) {
        throw new Error(ctx.t("statusRuntimeUnavailable"));
      }

      isSealing.set(true);
      phase.set("store");
      storageState.set("storing");
      lastStatus.set(ctx.t("statusRetryingStorage"));
      try {
        const sealed = await storePreparedPrivateTransfer({
          appId,
          prepared: pendingToEnvelope(pending),
          seal: app.oracle.seal,
        });
        completeStoredIntent(sealed);
        return sealed;
      } catch (error) {
        const key = normalizePrivateTransferErrorKey(error);
        const updated = savePendingSealedIntent(app.storage.local, {
          ...pending,
          attempts: pending.attempts + 1,
          lastError: key,
        });
        syncPending(updated);
        phase.set("recovery");
        const message = ctx.t(key);
        lastStatus.set(message);
        ctx.setStatus(message, "error");
        throw new Error(message);
      } finally {
        isSealing.set(false);
      }
    });

    app.actions.register("discardPending", async () => {
      if (isSealing.get()) return;
      clearPendingSealedIntent(app.storage.local);
      syncPending(null);
      storageState.set("unknown");
      phase.set(oracleState.get() === "ready" ? "draft" : "blocked");
      lastStatus.set(ctx.t("pendingDiscarded"));
      ctx.setStatus(ctx.t("pendingDiscarded"), "info");
    });

    return {
      state: {
        privacyMode,
        networkLabel,
        networkState,
        oracleState,
        oracleContract,
        oracleChecksum,
        oracleCheckedAt,
        storageState,
        phase,
        lastStatus,
        lastDigest,
        lastSecretRef,
        lastNullifier,
        lastStoredAt,
        isSealing,
        requestCount,
        hasPending,
        pendingCommitment,
        pendingAsset,
        pendingCreatedAt,
        pendingAttempts,
      },
      loadData: async () => {
        syncLatestHistory();
        syncPending(readPendingSealedIntent(app.storage.local));
        await refreshRuntime();
      },
    };
  },
});
