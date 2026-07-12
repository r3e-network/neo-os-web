import { createObservable, defineMiniApp } from "@shared/react/defineMiniApp";
import PlayArea from "./PlayArea";
import { appId, appMeta, manifest, messages } from "./appConfig";
import {
  buildLocalComputeRequest,
  isComputeProfile,
  isSourceDisclosure,
  inspectComputeSource,
  type ComputeDraft,
  type ComputeProfile,
  type SourceDisclosure,
} from "./compute-workbench";

function normalizeDraft(payload: unknown): ComputeDraft {
  const raw = payload && typeof payload === "object"
    ? payload as Record<string, unknown>
    : {};
  const profile = String(raw.profile ?? "risk-signal") as ComputeProfile;
  const disclosure = String(raw.disclosure ?? "digest-only") as SourceDisclosure;
  if (!isComputeProfile(profile)) throw new Error("invalid_profile");
  if (!isSourceDisclosure(disclosure)) throw new Error("invalid_disclosure");
  return { profile, disclosure, source: String(raw.source ?? "") };
}

function errorMessageKey(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? "");
  if (message === "source_required") return "sourceRequired";
  if (message === "source_too_large") return "sourceTooLarge";
  if (message === "source_too_deep") return "sourceTooDeep";
  if (message === "source_unsafe_number") return "sourceUnsafeNumber";
  if (message === "invalid_json") return "sourceInvalidJson";
  if (message === "shaUnavailable") return "digestUnavailable";
  return "statusFailed";
}

defineMiniApp({
  appId,
  playArea: PlayArea,
  manifest,
  messages,
  setup(ctx) {
    const networkLabel = createObservable(appMeta.networkLabel);
    const endpointLabel = createObservable(appMeta.endpointLabel);
    const runtimeBaseUrl = createObservable(appMeta.runtimeBaseUrl);
    const oracleContract = createObservable(appMeta.oracleContract);
    const envelopeVersion = createObservable(appMeta.envelopeVersion);
    const workflow = createObservable(appMeta.workflow);
    const route = createObservable(appMeta.route);
    const policiesLabel = createObservable(appMeta.policiesLabel);
    const teeRequired = createObservable(appMeta.teeRequired);
    const deliveryMode = createObservable(appMeta.deliveryMode);
    const requestDigestScope = createObservable(appMeta.requestDigestScope);
    const lastStatus = createObservable(ctx.t("statusReady"));
    const requestDigest = createObservable("");
    const inputDigest = createObservable("");
    const requestPackage = createObservable("");
    const requestCount = createObservable(0);
    const packageState = createObservable<"draft" | "preparing" | "ready" | "invalid" | "error">("draft");
    const isPreparing = createObservable(false);
    let generation = 0;

    const clearPreparedPackage = () => {
      requestDigest.set("");
      inputDigest.set("");
      requestPackage.set("");
    };

    ctx.framework.actions.register("invalidateRequest", async () => {
      generation += 1;
      isPreparing.set(false);
      clearPreparedPackage();
      packageState.set("draft");
      lastStatus.set(ctx.t("statusReady"));
    });

    ctx.framework.actions.register("prepareRequest", async (payload: unknown) => {
      let draft: ComputeDraft;
      try {
        draft = normalizeDraft(payload);
      } catch {
        generation += 1;
        isPreparing.set(false);
        clearPreparedPackage();
        packageState.set("error");
        lastStatus.set(ctx.t("statusFailed"));
        const message = ctx.t("statusFailed");
        ctx.setStatus(message, "error");
        throw new Error(message);
      }
      const inspected = inspectComputeSource(draft.source);
      if (!inspected.valid) {
        generation += 1;
        isPreparing.set(false);
        clearPreparedPackage();
        packageState.set("invalid");
        lastStatus.set(ctx.t("statusInvalid"));
        const message = ctx.t(errorMessageKey(new Error(inspected.error)));
        ctx.setStatus(message, "error");
        throw new Error(message);
      }

      const currentGeneration = ++generation;
      isPreparing.set(true);
      packageState.set("preparing");
      lastStatus.set(ctx.t("statusPreparing"));
      clearPreparedPackage();
      try {
        const prepared = await buildLocalComputeRequest(draft, appMeta.network);
        if (currentGeneration !== generation) return;
        const serialized = JSON.stringify(prepared, null, 2);
        requestDigest.set(prepared.requestDigest);
        inputDigest.set(prepared.payload.inputDigest);
        requestPackage.set(serialized);
        requestCount.set(requestCount.get() + 1);
        packageState.set("ready");
        lastStatus.set(ctx.t("statusPrepared"));
        ctx.setStatus(ctx.t("statusPrepared"), "success");
      } catch (error) {
        if (currentGeneration !== generation) return;
        clearPreparedPackage();
        const key = errorMessageKey(error);
        packageState.set(key === "statusFailed" ? "error" : "invalid");
        lastStatus.set(ctx.t(key === "statusFailed" ? "statusFailed" : "statusInvalid"));
        const message = ctx.t(key);
        ctx.setStatus(message, "error");
        throw new Error(message);
      } finally {
        if (currentGeneration === generation) isPreparing.set(false);
      }
    });

    ctx.framework.actions.register("copyRequestPackage", async () => {
      const serialized = requestPackage.get();
      if (!serialized) {
        ctx.setStatus(ctx.t("packageCopyUnavailable"), "error");
        return;
      }
      await ctx.services.clipboard.copy(serialized, "packageCopied");
    });

    return {
      state: {
        networkLabel,
        endpointLabel,
        runtimeBaseUrl,
        oracleContract,
        envelopeVersion,
        workflow,
        route,
        policiesLabel,
        teeRequired,
        deliveryMode,
        requestDigestScope,
        lastStatus,
        requestDigest,
        inputDigest,
        requestPackage,
        requestCount,
        packageState,
        isPreparing,
      },
      loadData: async () => {},
    };
  },
});
