import { createObservable, defineMiniApp } from "@shared/react";
import { getNetwork } from "@shared/constants/rpc";
import PlayArea from "./PlayArea";
import { appId, manifest, messages } from "./appConfig";
import {
  VRF_RESPONSE_LIMIT,
  buildVrfRequestDraft,
  markVrfServiceSnapshotStale,
  probeVrfService,
  restoreVrfRequestDraft,
  restoreVrfResponseText,
  shortValue,
  verifyVrfResponse,
  type ServiceAvailability,
  type VrfPurpose,
  type VrfRequestDraft,
  type VrfServiceSnapshot,
  type VrfVerificationResult,
} from "./vrf-workbench";

const DRAFT_STORAGE_KEY = "vrf/request-draft-v1";
const RESPONSE_STORAGE_KEY = "vrf/response-v1";
const SERVICE_STORAGE_KEY = "vrf/service-snapshot-v1";
const STORAGE_PROBE_KEY = "vrf/storage-probe-v1";

type ActionKind = "" | "draft" | "verify" | "clear";

function storageValueMatches(expected: unknown, actual: unknown): boolean {
  try {
    return JSON.stringify(expected) === JSON.stringify(actual);
  } catch {
    return false;
  }
}

function serviceLabelKey(availability: ServiceAvailability): string {
  if (availability === "network-mismatch") return "serviceMismatch";
  if (availability === "degraded") return "serviceDegraded";
  if (availability === "unavailable") return "serviceUnavailable";
  return "serviceProtected";
}

function verificationStatusKey(result: VrfVerificationResult): string {
  if (result.status === "verified") return "statusResponseVerified";
  if (result.status === "unbound") return "statusResponseUnbound";
  if (result.status === "blocked") return "statusVerificationBlocked";
  return "statusResponseInvalid";
}

defineMiniApp({
  appId,
  playArea: PlayArea,
  manifest,
  messages,
  setup(ctx) {
    const network = getNetwork();
    const storage = ctx.framework.storage.local;
    let initialStorageHealthy = true;
    const initialStorageGet = (key: string, fallback: unknown) => {
      try {
        return storage.get<unknown>(key, fallback);
      } catch {
        initialStorageHealthy = false;
        return fallback;
      }
    };
    const rawDraft = initialStorageGet(DRAFT_STORAGE_KEY, null);
    const rawResponse = initialStorageGet(RESPONSE_STORAGE_KEY, "");
    const rawService = initialStorageGet(SERVICE_STORAGE_KEY, null);
    const recoveredDraft = restoreVrfRequestDraft(
      rawDraft,
      network,
    );
    const recoveredResponse = recoveredDraft
      ? restoreVrfResponseText(rawResponse)
      : "";
    const cachedService = markVrfServiceSnapshotStale(
      rawService,
      network,
    );

    try {
      const marker = { version: 1, token: `${Date.now()}-${Math.random()}` };
      storage.set(STORAGE_PROBE_KEY, marker);
      if (!storageValueMatches(marker, storage.get<unknown>(STORAGE_PROBE_KEY, null))) {
        initialStorageHealthy = false;
      }
      storage.delete(STORAGE_PROBE_KEY);
      if (storage.get<unknown>(STORAGE_PROBE_KEY, null) !== null) {
        initialStorageHealthy = false;
      }
    } catch {
      initialStorageHealthy = false;
      try {
        storage.delete(STORAGE_PROBE_KEY);
      } catch {
        // Storage health remains false; the in-session workbench still works.
      }
    }

    const networkLabel = createObservable(
      ctx.t(network === "testnet" ? "networkTestnet" : "networkMainnet"),
    );
    const serviceLabel = createObservable(
      cachedService ? ctx.t("serviceStale") : ctx.t("serviceNotChecked"),
    );
    const lastStatus = createObservable(
      recoveredDraft ? ctx.t("statusDraftRecovered") : ctx.t("statusReady"),
    );
    const lastDigest = createObservable(
      recoveredDraft
        ? shortValue(recoveredDraft.request.request_id)
        : ctx.t("digestPlaceholder"),
    );
    const serviceSnapshot = createObservable<VrfServiceSnapshot | null>(cachedService);
    const draft = createObservable<VrfRequestDraft | null>(recoveredDraft);
    const responseText = createObservable(recoveredResponse);
    const verification = createObservable<VrfVerificationResult | null>(null);
    const actionBusy = createObservable(false);
    const actionKind = createObservable<ActionKind>("");
    const serviceBusy = createObservable(false);
    const storageHealthy = createObservable(initialStorageHealthy);
    const draftPersisted = createObservable(Boolean(recoveredDraft && initialStorageHealthy));
    let serviceEpoch = 0;
    let actionEpoch = 0;
    let activeAction: ActionKind = "";
    let disposed = false;

    function markStorageUnavailable() {
      storageHealthy.set(false);
    }

    function safeStorageGet(key: string, fallback: unknown) {
      try {
        return storage.get<unknown>(key, fallback);
      } catch {
        markStorageUnavailable();
        return fallback;
      }
    }

    function safeStorageSet(key: string, value: unknown): boolean {
      try {
        storage.set(key, value);
        const readback = storage.get<unknown>(key, null);
        if (!storageValueMatches(value, readback)) {
          markStorageUnavailable();
          return false;
        }
        return true;
      } catch {
        markStorageUnavailable();
        return false;
      }
    }

    function safeStorageDelete(key: string): boolean {
      try {
        storage.delete(key);
        if (storage.get<unknown>(key, null) !== null) {
          markStorageUnavailable();
          return false;
        }
        return true;
      } catch {
        markStorageUnavailable();
        return false;
      }
    }

    function probeStorageHealth(): boolean {
      try {
        const marker = { version: 1, token: `${Date.now()}-${Math.random()}` };
        storage.set(STORAGE_PROBE_KEY, marker);
        if (!storageValueMatches(marker, storage.get<unknown>(STORAGE_PROBE_KEY, null))) {
          throw new Error("storage write readback mismatch");
        }
        storage.delete(STORAGE_PROBE_KEY);
        if (storage.get<unknown>(STORAGE_PROBE_KEY, null) !== null) {
          throw new Error("storage delete readback mismatch");
        }
        storageHealthy.set(true);
        return true;
      } catch {
        markStorageUnavailable();
        try {
          storage.delete(STORAGE_PROBE_KEY);
        } catch {
          // Best-effort cleanup only; false health is the authoritative state.
        }
        return false;
      }
    }

    function beginAction(kind: Exclude<ActionKind, "">, announce: boolean): number | null {
      if (disposed || activeAction) {
        if (announce && !disposed) {
          lastStatus.set(ctx.t("statusOperationBusy"));
          ctx.setStatus(ctx.t("statusOperationBusy"), "warning");
        }
        return null;
      }
      activeAction = kind;
      const token = ++actionEpoch;
      actionBusy.set(true);
      actionKind.set(kind);
      return token;
    }

    function endAction(token: number) {
      if (token !== actionEpoch) return;
      activeAction = "";
      actionBusy.set(false);
      actionKind.set("");
    }

    function verificationContextKey(
      currentDraft: VrfRequestDraft | null,
      currentSnapshot: VrfServiceSnapshot | null,
    ): string {
      return [
        currentDraft?.request.request_id ?? "",
        currentSnapshot?.network ?? "",
        currentSnapshot?.responseSignerKey ?? "",
        String(currentSnapshot?.responseSignerPinned ?? false),
      ].join("|");
    }

    if (rawDraft != null && !recoveredDraft) safeStorageDelete(DRAFT_STORAGE_KEY);
    if (rawResponse && !recoveredResponse) safeStorageDelete(RESPONSE_STORAGE_KEY);
    if (rawService != null && !cachedService) safeStorageDelete(SERVICE_STORAGE_KEY);

    async function refreshService(announce: boolean) {
      const epoch = ++serviceEpoch;
      serviceBusy.set(true);
      serviceLabel.set(ctx.t("serviceChecking"));
      if (announce) lastStatus.set(ctx.t("statusCheckingService"));
      try {
        const next = await probeVrfService(network);
        if (disposed || epoch !== serviceEpoch) return next;
        const fallback = markVrfServiceSnapshotStale(
          safeStorageGet(SERVICE_STORAGE_KEY, null),
          network,
        );
        if (next.availability === "unavailable" && fallback) {
          serviceSnapshot.set(fallback);
          serviceLabel.set(ctx.t("serviceStale"));
          if (announce) {
            lastStatus.set(ctx.t("statusServiceRefreshFailed"));
            ctx.setStatus(ctx.t("statusServiceRefreshFailed"), "warning");
          }
          return fallback;
        }
        serviceSnapshot.set(next);
        serviceLabel.set(ctx.t(serviceLabelKey(next.availability)));
        if (next.contractVerifierKey) safeStorageSet(SERVICE_STORAGE_KEY, next);
        if (announce) {
          lastStatus.set(ctx.t("statusServiceRefreshed"));
          ctx.setStatus(
            ctx.t("statusServiceRefreshed"),
            next.availability === "protected" ? "info" : "warning",
          );
        }
        return next;
      } catch {
        const stale = markVrfServiceSnapshotStale(
          safeStorageGet(SERVICE_STORAGE_KEY, null),
          network,
        );
        if (disposed || epoch !== serviceEpoch) return stale;
        serviceSnapshot.set(stale);
        serviceLabel.set(ctx.t(stale ? "serviceStale" : "serviceUnavailable"));
        if (announce) {
          lastStatus.set(ctx.t("statusServiceRefreshFailed"));
          ctx.setStatus(ctx.t("statusServiceRefreshFailed"), "warning");
        }
        return stale;
      } finally {
        if (epoch === serviceEpoch) serviceBusy.set(false);
      }
    }

    async function applyVerification(
      text: string,
      announce: boolean,
      activeToken?: number,
    ) {
      const token = activeToken ?? beginAction("verify", announce);
      if (token == null) return null;
      const currentDraft = draft.get();
      const currentSnapshot = serviceSnapshot.get();
      const contextKey = verificationContextKey(currentDraft, currentSnapshot);
      try {
        const result = await verifyVrfResponse(
          text,
          currentDraft,
          currentSnapshot,
        );
        if (
          disposed
          || token !== actionEpoch
          || contextKey !== verificationContextKey(draft.get(), serviceSnapshot.get())
        ) {
          if (!disposed && token === actionEpoch) {
            verification.set(null);
            lastStatus.set(ctx.t("statusVerificationContextChanged"));
            if (announce) {
              ctx.setStatus(ctx.t("statusVerificationContextChanged"), "warning");
            }
          }
          return result;
        }
        verification.set(result);
        const statusKey = verificationStatusKey(result);
        lastStatus.set(ctx.t(statusKey));
        if (announce) {
          ctx.setStatus(
            ctx.t(statusKey),
            result.status === "verified"
              ? "success"
              : result.status === "blocked"
                ? "warning"
                : "error",
          );
        }
        return result;
      } finally {
        endAction(token);
      }
    }

    ctx.framework.actions.register("buildDraft", async (formData) => {
      const token = beginAction("draft", true);
      if (token == null) return;
      const form = formData && typeof formData === "object" && !Array.isArray(formData)
        ? formData as Record<string, unknown>
        : {};
      try {
        const next = buildVrfRequestDraft({
          consumer: String(form.consumer ?? ""),
          reference: String(form.reference ?? ""),
          purpose: String(form.purpose ?? "game") as VrfPurpose,
        }, network);
        draft.set(next);
        verification.set(null);
        responseText.set("");
        const storageReady = probeStorageHealth();
        const saved = storageReady && safeStorageSet(DRAFT_STORAGE_KEY, next);
        const previousResponseCleared = storageReady
          && safeStorageDelete(RESPONSE_STORAGE_KEY);
        const durable = saved && previousResponseCleared;
        draftPersisted.set(durable);
        lastDigest.set(shortValue(next.request.request_id));
        const statusKey = durable ? "statusDraftReady" : "statusDraftReadyLocalOnly";
        lastStatus.set(ctx.t(statusKey));
        ctx.setStatus(ctx.t(statusKey), durable ? "info" : "warning");
      } catch (error) {
        if (error instanceof Error && error.message === "secureNonceUnavailable") {
          throw new Error(ctx.t("secureNonceUnavailable"));
        }
        throw error;
      } finally {
        endAction(token);
      }
    });

    ctx.framework.actions.register("clearDraft", async () => {
      const token = beginAction("clear", true);
      if (token == null) return;
      try {
        const storageReady = probeStorageHealth();
        const draftRemoved = storageReady && safeStorageDelete(DRAFT_STORAGE_KEY);
        const responseRemoved = storageReady && safeStorageDelete(RESPONSE_STORAGE_KEY);
        draft.set(null);
        verification.set(null);
        responseText.set("");
        draftPersisted.set(false);
        lastDigest.set(ctx.t("digestPlaceholder"));
        const statusKey = draftRemoved && responseRemoved
          ? "statusDraftCleared"
          : "statusDraftClearUnconfirmed";
        lastStatus.set(ctx.t(statusKey));
        ctx.setStatus(ctx.t(statusKey), draftRemoved && responseRemoved ? "info" : "warning");
      } finally {
        endAction(token);
      }
    });

    ctx.framework.actions.register("refreshService", async () => {
      await refreshService(true);
    });

    ctx.framework.actions.register("verifyResponse", async (payload) => {
      const form = payload && typeof payload === "object" && !Array.isArray(payload)
        ? payload as Record<string, unknown>
        : {};
      const text = String(form.responseText ?? "").trim();
      const token = beginAction("verify", true);
      if (token == null) return;
      responseText.set(text.length <= VRF_RESPONSE_LIMIT ? text : "");
      if (text && text.length <= VRF_RESPONSE_LIMIT) {
        if (probeStorageHealth()) safeStorageSet(RESPONSE_STORAGE_KEY, text);
      } else {
        if (probeStorageHealth()) safeStorageDelete(RESPONSE_STORAGE_KEY);
      }
      await applyVerification(text, true, token);
    });

    return {
      state: {
        networkLabel,
        serviceLabel,
        lastStatus,
        lastDigest,
        serviceSnapshot,
        draft,
        responseText,
        verification,
        actionBusy,
        actionKind,
        serviceBusy,
        storageHealthy,
        draftPersisted,
      },
      loadData: async () => {
        // First paint stays network-quiet: the cross-origin service/chain
        // probes only run when the user asks (Refresh bindings), so booting
        // the console never spams CORS errors or flashes "Degraded" chips.
        // A cached snapshot (already marked stale) still lets a recovered
        // response re-verify without any live fetch.
        const recoveredDraftStillActive = Boolean(
          recoveredDraft
          && draft.get()?.request.request_id === recoveredDraft.request.request_id,
        );
        if (
          recoveredDraftStillActive
          && recoveredResponse
          && responseText.get() === recoveredResponse
          && serviceSnapshot.get()
        ) {
          await applyVerification(recoveredResponse, false);
        } else if (recoveredDraftStillActive) {
          lastStatus.set(ctx.t("statusDraftRecovered"));
        } else if (!draft.get()) {
          lastStatus.set(ctx.t("statusReady"));
        }
      },
      cleanup: () => {
        disposed = true;
        serviceEpoch++;
        actionEpoch++;
        activeAction = "";
        actionBusy.set(false);
        actionKind.set("");
      },
    };
  },
});
