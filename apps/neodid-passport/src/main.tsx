import { createObservable } from "@shared/react/context";
import { defineMiniApp } from "@shared/react/defineMiniApp";
import PlayArea from "./PlayArea";
import { appId, appMeta, manifest, messages } from "./appConfig";
import {
  attachWalletSignature,
  buildPassportPayload,
  buildPassportPendingOperation,
  canonicalize,
  explicitPassportNetwork,
  normalizeNetwork,
  normalizePassportForm,
  passportMatchesForm,
  probeNeoDidRegistry,
  resolveDidDocument,
  restorePassportPayload,
  restorePassportPendingOperation,
  serializePassportPayload,
  shortHash,
  validatePassportForm,
  type NeoDidRegistryProbe,
  type PassportForm,
  type PassportPayload,
} from "./passport";

const PASSPORT_STORAGE_KEY = "neodid/passport-review-v2";
const PENDING_STORAGE_KEY = "neodid/passport-pending-v1";

const KNOWN_ERROR_KEYS = [
  "nonceUnavailable",
  "passportAlreadySigned",
  "passportAudienceInvalid",
  "passportClaimInvalid",
  "passportExpired",
  "passportInvalidDid",
  "passportNoPayload",
  "passportPayloadChanged",
  "passportTimeInvalid",
  "resolverFailed",
  "resolverSubjectMismatch",
  "resolverUnavailable",
  "shaUnavailable",
  "walletAddressInvalid",
  "walletNetworkMismatch",
  "walletNetworkUnknown",
  "walletSignFailed",
];

function translateKnownError(
  error: unknown,
  t: (key: string, params?: Record<string, string | number>) => string,
) {
  const raw = error instanceof Error ? error.message : String(error || "");
  const key = raw || "resolverFailed";
  if (KNOWN_ERROR_KEYS.includes(key)) return t(key);
  if (/failed to fetch|networkerror|load failed|404|not found/i.test(key)) {
    return t("resolverUnavailable");
  }
  if (/wallet|sign|signature|public key/i.test(key)) return t("walletSignFailed");
  if (raw && !(error instanceof DOMException && error.name === "AbortError")) {
    console.warn("[neodid-passport] operation error:", raw);
  }
  return t("resolverFailed");
}

function idleRegistryProbe(environment: "mainnet" | "testnet"): NeoDidRegistryProbe {
  return {
    environment,
    status: "idle",
    contract: "",
    contractName: "",
    networkMagic: null,
    checkedAt: "",
    reason: "not-checked",
  };
}

function storageValueMatches(expected: unknown, actual: unknown) {
  try {
    return canonicalize(expected) === canonicalize(actual);
  } catch {
    return false;
  }
}

defineMiniApp({
  appId,
  playArea: PlayArea,
  manifest,
  messages,
  setup(ctx) {
    const network = normalizeNetwork(ctx.launchContext.network);
    const launchForm = normalizePassportForm({}, ctx.launchContext.params);
    let initialStorageHealthy = true;
    let rawPending: unknown = null;
    try {
      rawPending = ctx.framework.storage.local.get<unknown>(PENDING_STORAGE_KEY, null);
    } catch {
      initialStorageHealthy = false;
    }
    let pending = restorePassportPendingOperation(rawPending, network);
    const invalidPendingStored = Boolean(rawPending && !pending);

    const state = {
      network: createObservable(network),
      networkLabel: createObservable(network === "mainnet" ? "Morpheus Mainnet" : appMeta.networkLabel),
      endpointLabel: createObservable(appMeta.endpointLabel),
      // Seeded with the *idle* status, not "statusReady". This observable feeds
      // an aria-live status line that reports what just happened; seeding it
      // with "Passport review ready" announced a finished review on a first
      // paint where none exists, directly contradicting the passport stamp's
      // "Awaiting DID resolution" on the same screen. `statusReady` is still the
      // honest status after a successful reset (see resetPassport below), which
      // is the one moment the workspace really is ready and empty.
      lastStatus: createObservable(ctx.t("statusIdle")),
      lastDigest: createObservable(ctx.t("digestPlaceholder")),
      requestCount: createObservable(0),
      resolverStatus: createObservable(ctx.t("resolverNotCheckedStatus")),
      runtimeStatus: createObservable(ctx.t("runtimeNotCheckedStatus")),
      documentId: createObservable(ctx.t("digestPlaceholder")),
      documentVersion: createObservable(ctx.t("digestPlaceholder")),
      anchorContract: createObservable(ctx.t("digestPlaceholder")),
      serviceCount: createObservable(0),
      verificationMethodCount: createObservable(0),
      registryProbe: createObservable<NeoDidRegistryProbe>(idleRegistryProbe(network)),
      passportPayload: createObservable<PassportPayload | null>(null),
      recoveryForm: createObservable<PassportForm>(pending?.form ?? launchForm),
      recoveryStatus: createObservable(pending ? ctx.t("recoveryFound") : ""),
      storageHealthy: createObservable(initialStorageHealthy),
      lastError: createObservable(""),
      isResolving: createObservable(false),
      isSigning: createObservable(false),
    };

    let operationEpoch = 0;
    let disposed = false;
    let activeResolver: AbortController | null = null;

    const safeStorageSet = (key: string, value: unknown) => {
      try {
        ctx.framework.storage.local.set(key, value);
        const stored = ctx.framework.storage.local.get<unknown>(key, null);
        if (!storageValueMatches(value, stored)) {
          state.storageHealthy.set(false);
          return false;
        }
        return true;
      } catch {
        state.storageHealthy.set(false);
        return false;
      }
    };
    const safeStorageDelete = (key: string) => {
      try {
        ctx.framework.storage.local.delete(key);
        if (ctx.framework.storage.local.get<unknown>(key, null) !== null) {
          state.storageHealthy.set(false);
          return false;
        }
        return true;
      } catch {
        state.storageHealthy.set(false);
        return false;
      }
    };
    const safeStorageGet = (key: string) => {
      try {
        return ctx.framework.storage.local.get<unknown>(key, null);
      } catch {
        state.storageHealthy.set(false);
        return null;
      }
    };

    if (invalidPendingStored) safeStorageDelete(PENDING_STORAGE_KEY);

    const clearEvidence = (clearCount = false) => {
      state.lastDigest.set(ctx.t("digestPlaceholder"));
      state.resolverStatus.set(ctx.t("resolverNotCheckedStatus"));
      state.runtimeStatus.set(ctx.t("runtimeNotCheckedStatus"));
      state.documentId.set(ctx.t("digestPlaceholder"));
      state.documentVersion.set(ctx.t("digestPlaceholder"));
      state.anchorContract.set(ctx.t("digestPlaceholder"));
      state.serviceCount.set(0);
      state.verificationMethodCount.set(0);
      state.registryProbe.set(idleRegistryProbe(network));
      state.passportPayload.set(null);
      if (clearCount) state.requestCount.set(0);
    };

    const applyPayload = (payload: PassportPayload, probe: NeoDidRegistryProbe) => {
      state.passportPayload.set(payload);
      state.recoveryForm.set({
        subject: payload.subject,
        claim: payload.claim,
        audience: payload.audience,
      });
      state.lastDigest.set(shortHash(payload.digest));
      state.resolverStatus.set(ctx.t("documentReturnedStatus"));
      state.runtimeStatus.set(
        payload.assurance.runtimeAttestation === "metadata-available"
          ? ctx.t("runtimeMetadataAvailable")
          : ctx.t("runtimeMetadataUnavailable"),
      );
      state.documentId.set(payload.didDocument.id);
      state.documentVersion.set(payload.didDocument.versionId);
      state.anchorContract.set(payload.didDocument.anchorContract || ctx.t("digestPlaceholder"));
      state.serviceCount.set(payload.didDocument.serviceCount);
      state.verificationMethodCount.set(payload.didDocument.verificationMethodCount);
      state.registryProbe.set(probe);
    };

    const persistPayload = (payload: PassportPayload) => {
      pending = null;
      const persisted = safeStorageSet(PASSPORT_STORAGE_KEY, payload);
      const checkpointCleared = safeStorageDelete(PENDING_STORAGE_KEY);
      const recoverable = persisted && checkpointCleared;
      state.storageHealthy.set(recoverable);
      state.recoveryStatus.set(recoverable ? "" : ctx.t("storageUnavailableStatus"));
      return recoverable;
    };

    const invalidateActiveOperation = () => {
      pending = null;
      operationEpoch += 1;
      activeResolver?.abort();
      activeResolver = null;
      state.isResolving.set(false);
      state.isSigning.set(false);
      return safeStorageDelete(PENDING_STORAGE_KEY);
    };

    async function runBuild(
      form: PassportForm,
      options: { announce?: boolean; count?: boolean; recovered?: boolean } = {},
    ) {
      const { announce = true, count = true, recovered = false } = options;
      const validationKey = validatePassportForm(form);
      if (validationKey) {
        const message = ctx.t(validationKey);
        state.lastError.set(message);
        state.lastStatus.set(message);
        if (announce) ctx.setStatus(message, "error");
        return null;
      }
      if (state.isResolving.get() || state.isSigning.get()) return null;

      const epoch = ++operationEpoch;
      activeResolver?.abort();
      const controller = new AbortController();
      activeResolver = controller;
      clearEvidence(false);
      state.recoveryForm.set(form);
      state.isResolving.set(true);
      state.lastError.set("");
      state.lastStatus.set(recovered ? ctx.t("recoveryResuming") : ctx.t("resolvingStatus"));
      state.resolverStatus.set(ctx.t("resolvingStatus"));
      pending = null;
      safeStorageSet(
        PENDING_STORAGE_KEY,
        buildPassportPendingOperation("resolving", network, form),
      );

      try {
        const resolution = await resolveDidDocument(form, network, fetch, controller.signal);
        const probe = await probeNeoDidRegistry(network, resolution.anchorContract);
        const payload = await buildPassportPayload(
          form,
          resolution,
          network,
          undefined,
          undefined,
          probe,
        );
        if (disposed || epoch !== operationEpoch) return null;
        applyPayload(payload, probe);
        const persisted = persistPayload(payload);
        if (count) state.requestCount.set(Number(state.requestCount.get() ?? 0) + 1);

        const degraded = !resolution.runtimeAttested || probe.status !== "verified";
        const status = ctx.t(
          !persisted
            ? "passportReviewReadyStorageUnavailable"
            : degraded
              ? "passportReviewReadyDegraded"
              : "passportReviewReady",
        );
        state.lastStatus.set(status);
        if (announce) ctx.setStatus(status, degraded || !persisted ? "warning" : "success");
        return payload;
      } catch (error) {
        if (disposed || epoch !== operationEpoch || controller.signal.aborted) return null;
        clearEvidence(false);
        safeStorageDelete(PASSPORT_STORAGE_KEY);
        safeStorageDelete(PENDING_STORAGE_KEY);
        const message = translateKnownError(error, ctx.t);
        state.lastError.set(message);
        state.lastStatus.set(message);
        state.resolverStatus.set(message);
        if (announce) ctx.setStatus(message, "error");
        return null;
      } finally {
        if (!disposed && epoch === operationEpoch) {
          activeResolver = null;
          state.isResolving.set(false);
        }
      }
    }

    ctx.framework.actions.register("buildPassport", async (formData: unknown) => {
      const form = normalizePassportForm(formData, ctx.launchContext.params);
      return runBuild(form);
    });

    ctx.framework.actions.register("discardPassportReview", async () => {
      const checkpointCleared = invalidateActiveOperation();
      clearEvidence(false);
      const payloadCleared = safeStorageDelete(PASSPORT_STORAGE_KEY);
      const storageCleared = checkpointCleared && payloadCleared;
      state.storageHealthy.set(storageCleared);
      const status = ctx.t(storageCleared ? "draftChangedStatus" : "draftChangedStorageUnavailable");
      state.lastError.set("");
      state.recoveryStatus.set(storageCleared ? "" : status);
      state.lastStatus.set(status);
    });

    ctx.framework.actions.register("resetPassport", async () => {
      const checkpointCleared = invalidateActiveOperation();
      clearEvidence(true);
      state.recoveryForm.set(launchForm);
      state.lastError.set("");
      const payloadCleared = safeStorageDelete(PASSPORT_STORAGE_KEY);
      const storageCleared = checkpointCleared && payloadCleared;
      state.storageHealthy.set(storageCleared);
      const status = ctx.t(storageCleared ? "statusReady" : "resetStorageUnavailable");
      state.recoveryStatus.set(storageCleared ? "" : status);
      state.lastStatus.set(status);
      ctx.setStatus(status, storageCleared ? "info" : "warning");
    });

    ctx.framework.actions.register("signPassport", async (formData: unknown) => {
      if (state.isResolving.get() || state.isSigning.get()) return null;
      const payload = state.passportPayload.get();
      if (!payload) {
        const message = ctx.t("passportNoPayload");
        state.lastError.set(message);
        ctx.setStatus(message, "error");
        return null;
      }
      const form = normalizePassportForm(formData, ctx.launchContext.params);
      if (!passportMatchesForm(payload, form)) {
        const message = ctx.t("passportPayloadChanged");
        state.lastError.set(message);
        ctx.setStatus(message, "error");
        return null;
      }
      if (payload.proof.status === "attached") {
        const message = ctx.t("passportAlreadySigned");
        state.lastError.set(message);
        ctx.setStatus(message, "warning");
        return null;
      }
      if (Date.parse(payload.expiresAt) <= Date.now()) {
        const message = ctx.t("passportExpired");
        state.lastError.set(message);
        ctx.setStatus(message, "warning");
        return null;
      }

      const epoch = ++operationEpoch;
      state.isSigning.set(true);
      state.lastError.set("");
      state.lastStatus.set(ctx.t("waitingWalletStatus"));
      pending = null;
      safeStorageSet(
        PENDING_STORAGE_KEY,
        buildPassportPendingOperation("signing", network, form, payload.digest),
      );

      try {
        const ensuredAddress = String(await ctx.framework.chain.ensureWallet() ?? "").trim();
        if (disposed || epoch !== operationEpoch || state.passportPayload.get()?.digest !== payload.digest) {
          return null;
        }
        const observedAddress = String(ctx.framework.chain.address.get() ?? "").trim();
        if (ensuredAddress && observedAddress && ensuredAddress !== observedAddress) {
          throw new Error("walletAddressInvalid");
        }
        const walletAddress = observedAddress || ensuredAddress;
        const detectedBefore = explicitPassportNetwork(await ctx.framework.chain.detectNetwork());
        if (!detectedBefore) throw new Error("walletNetworkUnknown");
        if (detectedBefore !== network) throw new Error("walletNetworkMismatch");
        if (disposed || epoch !== operationEpoch || state.passportPayload.get()?.digest !== payload.digest) {
          return null;
        }
        const signed = await ctx.framework.chain.signMessage(canonicalize(payload));
        const detectedAfter = explicitPassportNetwork(await ctx.framework.chain.detectNetwork());
        const addressAfter = String(ctx.framework.chain.address.get() ?? "").trim() || walletAddress;
        if (!detectedAfter) throw new Error("walletNetworkUnknown");
        if (detectedAfter !== network) throw new Error("walletNetworkMismatch");
        if (!addressAfter || addressAfter !== walletAddress) throw new Error("walletAddressInvalid");
        if (disposed || epoch !== operationEpoch || state.passportPayload.get()?.digest !== payload.digest) {
          return null;
        }

        const signedPayload = await attachWalletSignature(
          payload,
          signed,
          addressAfter,
          network,
        );
        if (disposed || epoch !== operationEpoch) return null;
        applyPayload(signedPayload, state.registryProbe.get());
        const persisted = persistPayload(signedPayload);
        const status = ctx.t(
          persisted ? "passportProofAttached" : "passportProofAttachedStorageUnavailable",
        );
        state.lastStatus.set(status);
        ctx.setStatus(status, persisted ? "success" : "warning");
        return signedPayload;
      } catch (error) {
        if (disposed || epoch !== operationEpoch) return null;
        safeStorageDelete(PENDING_STORAGE_KEY);
        const message = translateKnownError(error, ctx.t);
        state.lastError.set(message);
        state.lastStatus.set(message);
        ctx.setStatus(message, "error");
        return null;
      } finally {
        if (!disposed && epoch === operationEpoch) state.isSigning.set(false);
      }
    });

    ctx.framework.actions.register("retryPassportStorage", async () => {
      if (state.isResolving.get() || state.isSigning.get()) return false;
      const payload = state.passportPayload.get();
      if (!payload) {
        const message = ctx.t("passportNoPayload");
        state.lastError.set(message);
        ctx.setStatus(message, "error");
        return false;
      }
      if (Date.parse(payload.expiresAt) <= Date.now()) {
        const message = ctx.t("passportExpired");
        state.lastError.set(message);
        ctx.setStatus(message, "warning");
        return false;
      }
      const persisted = persistPayload(payload);
      const message = ctx.t(persisted ? "storageRecoveryRestored" : "storageRecoveryFailed");
      state.lastError.set(persisted ? "" : message);
      state.lastStatus.set(message);
      state.recoveryStatus.set(persisted ? "" : message);
      ctx.setStatus(message, persisted ? "success" : "warning");
      return persisted;
    });

    ctx.framework.actions.register("copyPassportPayload", async () => {
      const payload = state.passportPayload.get();
      if (!payload) {
        ctx.setStatus(ctx.t("passportNoPayload"), "error");
        return false;
      }
      try {
        await ctx.framework.clipboard.copy(serializePassportPayload(payload), { successKey: "copied" });
        state.lastStatus.set(ctx.t("copied"));
        return true;
      } catch {
        ctx.setStatus(ctx.t("copyFailed"), "error");
        return false;
      }
    });

    return {
      state,
      loadData: async () => {
        const recoveryCheckpoint = pending;
        pending = null;
        const loadEpoch = operationEpoch;
        const rawPayload = safeStorageGet(PASSPORT_STORAGE_KEY);
        const restored = await restorePassportPayload(rawPayload, network);
        if (disposed || operationEpoch !== loadEpoch) return;
        if (rawPayload && !restored) safeStorageDelete(PASSPORT_STORAGE_KEY);

        if (recoveryCheckpoint?.phase === "resolving") {
          state.recoveryForm.set(recoveryCheckpoint.form);
          state.recoveryStatus.set(ctx.t("recoveryResuming"));
          await runBuild(recoveryCheckpoint.form, { announce: false, count: false, recovered: true });
          return;
        }

        if (restored) {
          const probe = await probeNeoDidRegistry(network, restored.didDocument.anchorContract);
          if (disposed || operationEpoch !== loadEpoch) return;
          applyPayload(restored, probe);
          state.requestCount.set(1);
          state.lastStatus.set(
            restored.proof.status === "attached"
              ? ctx.t("passportRecoveredAttached")
              : ctx.t("passportRecovered"),
          );
        }

        if (recoveryCheckpoint?.phase === "signing") {
          state.recoveryForm.set(recoveryCheckpoint.form);
          const recoveredExactPayload = Boolean(
            restored && restored.digest === recoveryCheckpoint.payloadDigest,
          );
          if (!recoveredExactPayload) {
            clearEvidence(false);
            safeStorageDelete(PASSPORT_STORAGE_KEY);
          }
          const message = ctx.t(
            recoveredExactPayload ? "signingInterrupted" : "signingRecoveryUnavailable",
          );
          state.recoveryStatus.set(message);
          state.lastStatus.set(message);
          safeStorageDelete(PENDING_STORAGE_KEY);
        } else {
          state.recoveryStatus.set("");
        }
      },
      cleanup: () => {
        disposed = true;
        operationEpoch += 1;
        activeResolver?.abort();
        activeResolver = null;
      },
    };
  },
});
