import { createObservable } from "@shared/react/context";
import { defineMiniApp } from "@shared/react/defineMiniApp";
import PlayArea from "./PlayArea";
import { appId, appMeta, manifest, messages } from "./appConfig";
import {
  buildEvidenceSnapshot,
  buildPendingOperation,
  canonicalize,
  idleRegistryProbe,
  loadProviderCatalog,
  normalizeConsoleForm,
  normalizeConsoleNetwork,
  probeNeoDidRegistry,
  resolveDidDocument,
  restoreEvidenceSnapshot,
  restorePendingOperation,
  serializeEvidence,
  shortDigest,
  unavailableProviderCatalog,
  validateConsoleForm,
  type NeoDidConsoleForm,
  type NeoDidEvidenceSnapshot,
  type NeoDidPendingOperation,
  type NeoDidRegistryProbe,
  type ProviderCatalogSnapshot,
} from "./neodid-console";

const EVIDENCE_STORAGE_KEY = "oracle-neodid-console/evidence-v1";
const PENDING_STORAGE_KEY = "oracle-neodid-console/pending-v1";
const STORAGE_PROBE_KEY_PREFIX = "oracle-neodid-console/storage-probe-v1";
const OPERATION_TIMEOUT_MS = 12_000;

const KNOWN_ERROR_KEYS = [
  "consoleClaimInvalid",
  "consoleInvalidDid",
  "consoleProviderInvalid",
  "evidenceTooLarge",
  "evidenceInvalid",
  "resolverFailed",
  "resolverSubjectMismatch",
  "shaUnavailable",
];

function translateError(
  error: unknown,
  t: (key: string, params?: Record<string, string | number>) => string,
) {
  const raw = error instanceof Error ? error.message : String(error || "");
  if (KNOWN_ERROR_KEYS.includes(raw)) return t(raw);
  if (/failed to fetch|networkerror|load failed|404|not found|abort/i.test(raw)) {
    return t("resolverUnavailable");
  }
  if (raw && !(error instanceof DOMException && error.name === "AbortError")) {
    console.warn("[oracle-neodid-console] read failed:", raw);
  }
  return t("resolverFailed");
}

function registryStatusKey(probe: NeoDidRegistryProbe) {
  if (probe.status === "verified") return "registryVerified";
  if (probe.status === "mismatch") return "registryMismatch";
  if (probe.reason === "no-network-deployment") return "registryNotDeployed";
  if (probe.status === "unavailable") return "registryUnavailable";
  return "notChecked";
}

defineMiniApp({
  appId,
  playArea: PlayArea,
  manifest,
  messages,
  setup(ctx) {
    const network = normalizeConsoleNetwork(ctx.launchContext.network);
    const launchForm = normalizeConsoleForm({}, ctx.launchContext.params);
    let storageHealthy = false;
    const storageProbeKey = `${STORAGE_PROBE_KEY_PREFIX}/${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const storageProbeValue = { version: 1, appId, key: storageProbeKey };
    try {
      ctx.framework.storage.local.set(storageProbeKey, storageProbeValue);
      const storedProbe = ctx.framework.storage.local.get<unknown>(storageProbeKey, null);
      ctx.framework.storage.local.delete(storageProbeKey);
      const clearedProbe = ctx.framework.storage.local.get<unknown>(storageProbeKey, null);
      storageHealthy = canonicalize(storedProbe) === canonicalize(storageProbeValue) && clearedProbe === null;
    } catch {
      storageHealthy = false;
      try {
        ctx.framework.storage.local.delete(storageProbeKey);
      } catch {
        // The recovery status remains unavailable.
      }
    }
    let rawPending: unknown = null;
    try {
      rawPending = ctx.framework.storage.local.get<unknown>(PENDING_STORAGE_KEY, null);
    } catch {
      storageHealthy = false;
    }
    let pending: NeoDidPendingOperation | null = restorePendingOperation(rawPending, network);
    if (rawPending && !pending) {
      try {
        ctx.framework.storage.local.delete(PENDING_STORAGE_KEY);
        if (ctx.framework.storage.local.get<unknown>(PENDING_STORAGE_KEY, null) !== null) {
          storageHealthy = false;
        }
      } catch {
        storageHealthy = false;
      }
    }

    const state = {
      network: createObservable(network),
      networkLabel: createObservable(network === "mainnet" ? "Morpheus Mainnet" : "Morpheus Testnet"),
      endpointLabel: createObservable(appMeta.endpointLabel),
      lastStatus: createObservable(ctx.t("statusReady")),
      lastError: createObservable(""),
      lastDigest: createObservable(ctx.t("digestPlaceholder")),
      evidenceStatus: createObservable(ctx.t("evidenceNotReady")),
      registryStatus: createObservable(ctx.t("notChecked")),
      providerCount: createObservable(0),
      requestCount: createObservable(0),
      isResolving: createObservable(false),
      isCatalogLoading: createObservable(false),
      storageHealthy: createObservable(storageHealthy),
      recoveryStatus: createObservable(pending ? ctx.t("recoveryFound") : ""),
      recoveryForm: createObservable<NeoDidConsoleForm>(pending?.form ?? launchForm),
      evidence: createObservable<NeoDidEvidenceSnapshot | null>(null),
      providerCatalog: createObservable<ProviderCatalogSnapshot | null>(null),
      registryProbe: createObservable<NeoDidRegistryProbe>(idleRegistryProbe(network)),
    };

    let operationEpoch = 0;
    let catalogEpoch = 0;
    let disposed = false;
    let loaded = false;
    let loadPromise: Promise<void> | null = null;
    let activeOperation: AbortController | null = null;
    let activeCatalog: AbortController | null = null;

    const safeStorageSet = (key: string, value: unknown) => {
      try {
        ctx.framework.storage.local.set(key, value);
        const persisted = ctx.framework.storage.local.get<unknown>(key, null);
        if (canonicalize(persisted) !== canonicalize(value)) throw new Error("storage-readback-failed");
        state.storageHealthy.set(true);
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
    const safeStorageDelete = (key: string) => {
      try {
        ctx.framework.storage.local.delete(key);
        if (ctx.framework.storage.local.get<unknown>(key, null) !== null) {
          throw new Error("storage-delete-readback-failed");
        }
        return true;
      } catch {
        state.storageHealthy.set(false);
        return false;
      }
    };

    const clearEvidence = (clearCount = false) => {
      state.evidence.set(null);
      state.lastDigest.set(ctx.t("digestPlaceholder"));
      state.evidenceStatus.set(ctx.t("evidenceNotReady"));
      state.registryStatus.set(ctx.t("notChecked"));
      state.registryProbe.set(idleRegistryProbe(network));
      if (clearCount) state.requestCount.set(0);
    };

    const applyCatalog = (catalog: ProviderCatalogSnapshot) => {
      state.providerCatalog.set(catalog);
      state.providerCount.set(catalog.providers.length);
    };

    const applyEvidence = (evidence: NeoDidEvidenceSnapshot) => {
      state.evidence.set(evidence);
      state.lastDigest.set(shortDigest(evidence.digest));
      state.evidenceStatus.set(ctx.t("recordReady"));
      state.registryProbe.set(evidence.registry);
      state.registryStatus.set(ctx.t(registryStatusKey(evidence.registry)));
      state.recoveryForm.set({
        did: evidence.subject,
        provider: evidence.context.requestedProvider,
        claim: evidence.context.requestedClaim,
      });
      applyCatalog(evidence.catalog);
    };

    const invalidateOperation = () => {
      operationEpoch += 1;
      activeOperation?.abort();
      activeOperation = null;
      state.isResolving.set(false);
      pending = null;
      safeStorageDelete(PENDING_STORAGE_KEY);
    };

    async function refreshCatalog(announce = false) {
      if (state.isResolving.get()) return state.providerCatalog.get();
      const epoch = ++catalogEpoch;
      activeCatalog?.abort();
      const controller = new AbortController();
      activeCatalog = controller;
      state.isCatalogLoading.set(true);
      try {
        const catalog = await loadProviderCatalog(network, fetch, controller.signal);
        if (disposed || epoch !== catalogEpoch) return null;
        applyCatalog(catalog);
        if (announce) ctx.setStatus(ctx.t("catalogLoaded"), "success");
        return catalog;
      } catch {
        if (disposed || epoch !== catalogEpoch || controller.signal.aborted) return null;
        const catalog = unavailableProviderCatalog(network);
        applyCatalog(catalog);
        if (announce) ctx.setStatus(ctx.t("catalogLoadFailed"), "warning");
        return catalog;
      } finally {
        if (!disposed && epoch === catalogEpoch) {
          activeCatalog = null;
          state.isCatalogLoading.set(false);
        }
      }
    }

    async function runResolve(
      form: NeoDidConsoleForm,
      options: { announce?: boolean; count?: boolean; recovered?: boolean } = {},
    ) {
      const { announce = true, count = true, recovered = false } = options;
      const validationKey = validateConsoleForm(form);
      if (validationKey) {
        clearEvidence(false);
        safeStorageDelete(EVIDENCE_STORAGE_KEY);
        const message = ctx.t(validationKey);
        state.lastError.set(message);
        state.lastStatus.set(message);
        state.recoveryStatus.set("");
        if (announce) ctx.setStatus(message, "error");
        return null;
      }
      if (state.isResolving.get()) return null;

      const epoch = ++operationEpoch;
      activeOperation?.abort();
      activeCatalog?.abort();
      catalogEpoch += 1;
      activeCatalog = null;
      state.isCatalogLoading.set(false);
      const controller = new AbortController();
      activeOperation = controller;
      let timedOut = false;
      const timeout = globalThis.setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, OPERATION_TIMEOUT_MS);

      clearEvidence(false);
      safeStorageDelete(EVIDENCE_STORAGE_KEY);
      state.recoveryForm.set(form);
      state.isResolving.set(true);
      state.lastError.set("");
      state.recoveryStatus.set(recovered ? ctx.t("recoveryResuming") : "");
      state.lastStatus.set(recovered ? ctx.t("recoveryResuming") : ctx.t("resolvingStatus"));
      pending = buildPendingOperation(network, form);
      safeStorageSet(PENDING_STORAGE_KEY, pending);

      try {
        const catalogPromise = loadProviderCatalog(network, fetch, controller.signal)
          .catch((error) => {
            if (controller.signal.aborted) throw error;
            return unavailableProviderCatalog(network);
          });
        const resolution = await resolveDidDocument(form, network, fetch, controller.signal);
        const [catalog, registry] = await Promise.all([
          catalogPromise,
          probeNeoDidRegistry(network, resolution.anchorContract, undefined, undefined, controller.signal),
        ]);
        const evidence = await buildEvidenceSnapshot(form, resolution, catalog, registry);
        if (disposed || epoch !== operationEpoch) return null;

        applyEvidence(evidence);
        pending = null;
        const persisted = safeStorageSet(EVIDENCE_STORAGE_KEY, evidence);
        const pendingCleared = safeStorageDelete(PENDING_STORAGE_KEY);
        const recoveryReady = persisted && pendingCleared;
        state.recoveryStatus.set(recoveryReady ? "" : ctx.t("recoveryUnavailable"));
        if (count) state.requestCount.set(Number(state.requestCount.get() ?? 0) + 1);

        const degraded = catalog.status !== "providers-returned" ||
          registry.status !== "verified" ||
          !resolution.runtimeVerifierMetadata ||
          evidence.context.status !== "claim-listed";
        const status = ctx.t(
          !recoveryReady ? "evidenceReadyNoStorage" : degraded ? "evidenceReadyDegraded" : "evidenceReady",
        );
        state.lastStatus.set(status);
        if (announce) ctx.setStatus(status, degraded || !recoveryReady ? "warning" : "success");
        return evidence;
      } catch (error) {
        if (disposed || epoch !== operationEpoch) return null;
        controller.abort();
        clearEvidence(false);
        pending = null;
        safeStorageDelete(EVIDENCE_STORAGE_KEY);
        safeStorageDelete(PENDING_STORAGE_KEY);
        const message = timedOut ? ctx.t("requestTimedOut") : translateError(error, ctx.t);
        state.lastError.set(message);
        state.lastStatus.set(message);
        state.recoveryStatus.set("");
        if (announce) ctx.setStatus(message, "error");
        return null;
      } finally {
        controller.abort();
        globalThis.clearTimeout(timeout);
        if (!disposed && epoch === operationEpoch) {
          activeOperation = null;
          state.isResolving.set(false);
        }
      }
    }

    ctx.framework.actions.register("resolveEvidence", async (formData: unknown) => {
      return runResolve(normalizeConsoleForm(formData, ctx.launchContext.params));
    });

    ctx.framework.actions.register("discardEvidence", async () => {
      invalidateOperation();
      clearEvidence(false);
      safeStorageDelete(EVIDENCE_STORAGE_KEY);
      state.lastError.set("");
      state.recoveryStatus.set("");
      state.lastStatus.set(ctx.t("draftChanged"));
    });

    const expireCurrentEvidence = () => {
      invalidateOperation();
      clearEvidence(false);
      safeStorageDelete(EVIDENCE_STORAGE_KEY);
      state.lastError.set("");
      state.recoveryStatus.set("");
      state.lastStatus.set(ctx.t("evidenceExpired"));
      ctx.setStatus(ctx.t("evidenceExpired"), "warning");
    };

    ctx.framework.actions.register("expireEvidence", async () => expireCurrentEvidence());

    ctx.framework.actions.register("resetEvidence", async () => {
      invalidateOperation();
      clearEvidence(true);
      state.recoveryForm.set(launchForm);
      state.lastError.set("");
      state.recoveryStatus.set("");
      state.lastStatus.set(ctx.t("statusReady"));
      safeStorageDelete(EVIDENCE_STORAGE_KEY);
      ctx.setStatus(ctx.t("statusReady"), "info");
    });

    ctx.framework.actions.register("refreshProviderCatalog", async () => refreshCatalog(true));

    ctx.framework.actions.register("copyEvidence", async () => {
      const evidence = state.evidence.get();
      if (!evidence) return false;
      if (!Number.isFinite(Date.parse(evidence.expiresAt)) || Date.parse(evidence.expiresAt) <= Date.now()) {
        expireCurrentEvidence();
        return false;
      }
      try {
        const verified = await restoreEvidenceSnapshot(evidence, network, Date.now());
        if (!verified) {
          clearEvidence(false);
          safeStorageDelete(EVIDENCE_STORAGE_KEY);
          const message = ctx.t("evidenceInvalid");
          state.lastError.set(message);
          state.lastStatus.set(message);
          ctx.setStatus(message, "error");
          return false;
        }
        const copied = await ctx.framework.clipboard.copy(serializeEvidence(verified), {
          successKey: "copied",
          errorKey: "copyFailed",
        });
        if (!copied) {
          state.lastStatus.set(ctx.t("copyFailed"));
          return false;
        }
        state.lastError.set("");
        state.lastStatus.set(ctx.t("copied"));
        return true;
      } catch {
        state.lastStatus.set(ctx.t("copyFailed"));
        ctx.setStatus(ctx.t("copyFailed"), "error");
        return false;
      }
    });

    async function loadInitialData() {
      const recoveryCheckpoint = pending;
      pending = null;
      if (recoveryCheckpoint) safeStorageDelete(PENDING_STORAGE_KEY);

      const loadEpoch = operationEpoch;
      const rawEvidence = safeStorageGet(EVIDENCE_STORAGE_KEY);
      const restored = await restoreEvidenceSnapshot(rawEvidence, network);
      if (disposed || loadEpoch !== operationEpoch) return;
      if (rawEvidence && !restored) safeStorageDelete(EVIDENCE_STORAGE_KEY);

      if (recoveryCheckpoint) {
        state.recoveryForm.set(recoveryCheckpoint.form);
        state.recoveryStatus.set(ctx.t("recoveryResuming"));
        await runResolve(recoveryCheckpoint.form, {
          announce: false,
          count: false,
          recovered: true,
        });
        return;
      }

      if (restored) {
        applyEvidence(restored);
        state.requestCount.set(1);
        state.lastStatus.set(ctx.t("evidenceRecovered"));
        state.recoveryStatus.set("");
      }
      await refreshCatalog(false);
    }

    return {
      state,
      loadData: () => {
        if (disposed || loaded) return Promise.resolve();
        if (loadPromise) return loadPromise;
        loadPromise = loadInitialData().finally(() => {
          loaded = true;
          loadPromise = null;
        });
        return loadPromise;
      },
      cleanup: () => {
        disposed = true;
        loaded = true;
        operationEpoch += 1;
        catalogEpoch += 1;
        activeOperation?.abort();
        activeCatalog?.abort();
        activeOperation = null;
        activeCatalog = null;
      },
    };
  },
});
