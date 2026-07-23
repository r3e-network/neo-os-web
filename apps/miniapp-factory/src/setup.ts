import {
  createObservable,
  type MiniAppSetupContext,
  type MiniAppSetupResult,
} from "@shared/react/defineMiniApp";
import { createDerived, createReadCell } from "@shared/react/context";
import {
  buildFactoryPlan,
  createFactoryDraftFromLaunchContext,
  factoryContractFor,
  type FactoryArtifactPresence,
  type FactoryNetwork,
  type FactoryPlan,
  type MiniAppDraft,
} from "@shared/factory/factoryPlan";
import {
  estimateFactoryFeeGas,
  fetchFactoryDeployments,
  fetchTemplateArtifactPresence,
  inspectFactoryRecord,
  type FactoryDeploymentItem,
} from "@shared/factory/factoryChain";
import {
  MINIAPP_DRAFT_SCHEMA,
  applyVerifiedTemplateGate,
  createStoredMiniAppDraft,
  normalizeMiniAppDraft,
  parseStoredMiniAppDraft,
} from "./studio-artifacts";

const DRAFT_STORAGE_KEY = "studio/draft-v1";
const REGISTRATION_STORAGE_KEY = "studio/registration-v1";
const ARTIFACT_CACHE_TTL_MS = 60_000;
const DEPLOYMENTS_PAGE_SIZE = 8;
const REGISTRATION_SCHEMA = "neo-miniapp-factory-registration:v1";
const TESTNET: FactoryNetwork = "neo-n3-testnet";

export type DraftJournalState = "loading" | "ready" | "restored" | "unavailable";
export type RegistrationState =
  | "idle"
  | "checking"
  | "submitting"
  | "submitted"
  | "confirmed"
  | "mismatch"
  | "uncertain"
  | "unavailable";

export interface MiniAppPlanSignature {
  signature: string;
  publicKey: string;
  message: string;
  signedAt: string;
  digest: string;
}

export interface RegistrationSnapshot {
  schema: typeof REGISTRATION_SCHEMA;
  packageId: string;
  digest: string;
  templateId: string;
  network: FactoryNetwork;
  scriptHash: string;
  txid: string;
  submittedAt: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function text(value: unknown, max = 256): string {
  return String(value ?? "").trim().slice(0, max);
}

function parseRegistrationSnapshot(value: unknown): RegistrationSnapshot | null {
  if (!isRecord(value) || value.schema !== REGISTRATION_SCHEMA) return null;
  const packageId = text(value.packageId, 180);
  const digest = text(value.digest, 80).toLowerCase();
  const templateId = text(value.templateId, 120);
  const scriptHash = text(value.scriptHash, 48).toLowerCase();
  const txid = text(value.txid, 80).toLowerCase();
  const submittedAt = text(value.submittedAt, 40);
  if (
    !packageId ||
    !/^0x[0-9a-f]{64}$/.test(digest) ||
    !templateId ||
    !/^0x[0-9a-f]{40}$/.test(scriptHash) ||
    !Number.isFinite(Date.parse(submittedAt))
  ) {
    return null;
  }
  if (txid && !/^0x[0-9a-f]{64}$/.test(txid)) return null;
  return {
    schema: REGISTRATION_SCHEMA,
    packageId,
    digest,
    templateId,
    network: TESTNET,
    scriptHash,
    txid,
    submittedAt,
  };
}

function friendlyError(
  error: unknown,
  t: MiniAppSetupContext["t"],
  fallbackKey: string,
): string {
  const raw = error instanceof Error ? error.message : text(error);
  const passthrough = [
    t("alreadyExecuted"),
    t("registrationPlanInvalid"),
    t("registrationTxMissing"),
    t("templateNotRegistered"),
    t("templateVerificationRequired"),
    t("testnetRequired"),
  ];
  if (passthrough.includes(raw)) return raw;
  if (/reject|cancel|declin/i.test(raw)) return t("walletCancelled");
  if (/not support|unsupported/i.test(raw)) return t("walletSigningUnsupported");
  if (/network|chain/i.test(raw)) return t("testnetRequired");
  return t(fallbackKey);
}

function detectedNetwork(value: unknown): FactoryNetwork | null {
  const raw = text(value).toLowerCase();
  if (raw === "testnet" || raw === TESTNET) return TESTNET;
  if (raw === "mainnet" || raw === "neo-n3-mainnet") return "neo-n3-mainnet";
  return null;
}

export function createMiniAppFactorySetup(appId: string) {
  return function setup(ctx: MiniAppSetupContext): MiniAppSetupResult {
    const launchDraft = createFactoryDraftFromLaunchContext(ctx.launchContext, "miniapp").miniapp;
    const initialDraft = normalizeMiniAppDraft(launchDraft, launchDraft);

    const currentPlan = createObservable<FactoryPlan | null>(null);
    const planStatus = createObservable(ctx.t("planDraftReady"));
    const shortDigest = createObservable("-");
    const blockingIssueCount = createObservable(0);
    const generatedCount = createObservable(0);
    const signatureState = createObservable(ctx.t("unsigned"));
    const walletSignature = createObservable("");
    const walletSignatureInfo = createObservable<MiniAppPlanSignature | null>(null);
    const isSigning = createObservable(false);
    const isGenerating = createObservable(false);
    const isExecuting = createObservable(false);
    const lastError = createObservable("");
    const lastTxid = createObservable("");
    const executedDigest = createObservable("");
    const feeEstimateGas = createObservable("");
    const artifactPresence = createObservable<Record<string, FactoryArtifactPresence>>({});
    // The deployments read lane on the platform read-cell (read-cell adoption):
    // one cell owns the {items,total} registry snapshot plus the "have we asked
    // yet?" status. The cell's status union is the legacy state union verbatim
    // ("idle" | "loading" | "ready" | "error"), its epoch replaces the
    // hand-rolled deploymentsToken (last-write-wins on overlapping loads), and
    // a failed read keeps the last good snapshot renderable — identical
    // keep-last-good-on-error semantics to the replaced plumbing.
    const deploymentsCell = createReadCell(
      async (): Promise<{ items: FactoryDeploymentItem[]; total: number }> => {
        const scriptHash = factoryContractFor("miniapp", TESTNET);
        const result = await fetchFactoryDeployments(
          TESTNET,
          scriptHash,
          "miniapp",
          DEPLOYMENTS_PAGE_SIZE,
        );
        return { items: result.items, total: result.total };
      },
    );
    const deployments = createDerived<FactoryDeploymentItem[]>(
      () => deploymentsCell.value.get()?.items ?? [],
      [deploymentsCell.value],
    );
    const deploymentsTotal = createDerived(
      () => deploymentsCell.value.get()?.total ?? 0,
      [deploymentsCell.value],
    );
    const deploymentsState = deploymentsCell.status;

    const restoredDraft = createObservable<MiniAppDraft | null>(null);
    const draftJournalState = createObservable<DraftJournalState>("loading");
    const registrationState = createObservable<RegistrationState>("idle");
    const registrationSnapshot = createObservable<RegistrationSnapshot | null>(null);
    const registrationRecord = createObservable<FactoryDeploymentItem | null>(null);
    const registrationReadError = createObservable("");

    const presenceCache = new Map<string, { presence: FactoryArtifactPresence; at: number }>();
    let disposed = false;
    let feeEstimateToken = 0;
    let registrationToken = 0;

    function presenceKey(network: FactoryNetwork, templateId: string): string {
      return `${network}|${templateId}`;
    }

    function persistRegistration(snapshot: RegistrationSnapshot): void {
      registrationSnapshot.set(snapshot);
      ctx.framework.storage.local.set(REGISTRATION_STORAGE_KEY, snapshot);
    }

    function applyPlan(plan: FactoryPlan): void {
      const previousDigest = currentPlan.get()?.digest ?? "";
      currentPlan.set(plan);
      planStatus.set(plan.publishable ? ctx.t("packageReady") : ctx.t("packageBlocked"));
      shortDigest.set(plan.digest.slice(-10));
      blockingIssueCount.set(plan.blockingErrors.length);
      if (plan.publishable && plan.digest !== previousDigest) {
        generatedCount.set(generatedCount.get() + 1);
      }
      signatureState.set(ctx.t("unsigned"));
      walletSignature.set("");
      walletSignatureInfo.set(null);
      lastError.set("");
    }

    function rejectAction(key: string, tone: "warning" | "error" = "warning"): void {
      const message = ctx.t(key);
      lastError.set(message);
      ctx.setStatus(message, tone);
    }

    async function resolveArtifactPresence(
      templateId: string,
      scriptHash: string,
      force = false,
    ): Promise<FactoryArtifactPresence> {
      const key = presenceKey(TESTNET, templateId);
      const cached = presenceCache.get(key);
      if (!force && cached && Date.now() - cached.at < ARTIFACT_CACHE_TTL_MS) {
        return cached.presence;
      }
      const presence = scriptHash
        ? await fetchTemplateArtifactPresence(TESTNET, scriptHash, templateId)
        : "unknown";
      if (presence !== "unknown") {
        presenceCache.set(key, { presence, at: Date.now() });
      }
      if (!disposed) {
        artifactPresence.set({ ...artifactPresence.get(), [key]: presence });
      }
      return presence;
    }

    function refreshFeeEstimate(plan: FactoryPlan): void {
      const token = ++feeEstimateToken;
      feeEstimateGas.set("");
      if (!plan.publishable || !plan.execution.available) return;
      const signer = ctx.framework.chain.address.get() || plan.execution.signerHint;
      if (!signer) return;
      void estimateFactoryFeeGas(TESTNET, plan.deploymentCall, signer).then((estimate) => {
        if (!disposed && token === feeEstimateToken) feeEstimateGas.set(estimate);
      });
    }

    async function loadDeployments(): Promise<void> {
      // Dispose guard on load(): a torn-down setup never starts a new read
      // (the legacy token bump only suppressed the publish; guarding the load
      // is the same non-observable outcome with no wasted fetch).
      if (disposed) return;
      // Failures surface as deploymentsState === "error" on the cell; the
      // legacy loader never rejected, so callers must not see this reject.
      await deploymentsCell.load().catch(() => {});
    }

    async function recoverRegistration(snapshot: RegistrationSnapshot): Promise<void> {
      const token = ++registrationToken;
      registrationState.set("checking");
      registrationReadError.set("");
      const result = await inspectFactoryRecord(
        snapshot.network,
        snapshot.scriptHash,
        "miniapp",
        snapshot.packageId,
      );
      if (disposed || token !== registrationToken) return;

      if (result.status === "found") {
        registrationRecord.set(result.record);
        const matches =
          result.record.digest.toLowerCase() === snapshot.digest &&
          result.record.templateId === snapshot.templateId;
        registrationState.set(matches ? "confirmed" : "mismatch");
        if (matches) executedDigest.set(snapshot.digest);
        return;
      }
      registrationRecord.set(null);
      if (result.status === "not-found") {
        registrationState.set(snapshot.txid ? "submitted" : "uncertain");
        return;
      }
      registrationReadError.set(result.error);
      registrationState.set("unavailable");
    }

    ctx.framework.actions.register("persistMiniAppDraft", (...args: unknown[]) => {
      const draft = normalizeMiniAppDraft(args[0], initialDraft);
      try {
        const stored = createStoredMiniAppDraft(draft);
        ctx.framework.storage.local.set(DRAFT_STORAGE_KEY, stored);
        const readback = ctx.framework.storage.local.get<unknown>(DRAFT_STORAGE_KEY, null);
        const parsed = parseStoredMiniAppDraft(readback, initialDraft);
        draftJournalState.set(parsed ? "ready" : "unavailable");
      } catch {
        draftJournalState.set("unavailable");
      }
    });

    ctx.framework.actions.register("clearMiniAppDraft", () => {
      ctx.framework.storage.local.delete(DRAFT_STORAGE_KEY);
      restoredDraft.set(null);
      draftJournalState.set("ready");
    });

    ctx.framework.actions.register("generatePlan", async (...args: unknown[]) => {
      if (isGenerating.get()) return;
      isGenerating.set(true);
      lastError.set("");
      try {
        const draft = normalizeMiniAppDraft(args[0], initialDraft);
        const preliminary = buildFactoryPlan("miniapp", draft as unknown as Record<string, unknown>, {
          appId,
        });
        const presence = await resolveArtifactPresence(
          preliminary.templateId,
          preliminary.deploymentCall.scriptHash,
        );
        const generated = buildFactoryPlan("miniapp", draft as unknown as Record<string, unknown>, {
          appId,
          artifactPresence: presence,
        });
        const plan = applyVerifiedTemplateGate(generated, presence);
        applyPlan(plan);
        refreshFeeEstimate(plan);
        ctx.setStatus(
          plan.publishable ? ctx.t("packageReady") : ctx.t("packageBlocked"),
          plan.publishable ? "success" : "warning",
        );
      } catch (error) {
        const message = friendlyError(error, ctx.t, "planGenerateFailed");
        lastError.set(message);
        ctx.setStatus(message, "error");
      } finally {
        isGenerating.set(false);
      }
    });

    ctx.framework.actions.register("discardPlan", () => {
      feeEstimateToken += 1;
      currentPlan.set(null);
      planStatus.set(ctx.t("planDraftReady"));
      shortDigest.set("-");
      blockingIssueCount.set(0);
      signatureState.set(ctx.t("unsigned"));
      walletSignature.set("");
      walletSignatureInfo.set(null);
      feeEstimateGas.set("");
      lastError.set("");
      ctx.clearStatus();
    });

    ctx.framework.actions.register("signCurrentPlan", async () => {
      if (isSigning.get()) return;
      const plan = currentPlan.get();
      if (!plan) {
        rejectAction("noPlanToSign");
        return;
      }
      if (!plan.publishable) {
        rejectAction("packageBlocked");
        return;
      }

      const requestDigest = plan.digest;
      isSigning.set(true);
      lastError.set("");
      try {
        const message = [
          "neo-miniapp-factory-plan:v1",
          `network:${plan.network}`,
          `template:${plan.templateId}`,
          `package:${plan.packageId}`,
          `digest:${plan.digest}`,
        ].join("\n");
        const signed = await ctx.framework.chain.signMessage(message);
        if (currentPlan.get()?.digest !== requestDigest) {
          throw new Error(ctx.t("planChangedDuringSign"));
        }
        walletSignature.set(signed.signature);
        walletSignatureInfo.set({
          signature: signed.signature,
          publicKey: signed.publicKey ?? "",
          message,
          signedAt: new Date().toISOString(),
          digest: requestDigest,
        });
        signatureState.set(ctx.t("signed"));
        ctx.setStatus(ctx.t("planSigned"), "success");
      } catch (error) {
        const message =
          error instanceof Error && error.message === ctx.t("planChangedDuringSign")
            ? error.message
            : friendlyError(error, ctx.t, "signFailed");
        lastError.set(message);
        walletSignature.set("");
        walletSignatureInfo.set(null);
      } finally {
        isSigning.set(false);
      }
    });

    ctx.framework.actions.register("executePlan", async () => {
      if (isExecuting.get()) return;
      const plan = currentPlan.get();
      if (!plan) {
        rejectAction("noPlanToSign");
        return;
      }
      if (!plan.publishable) {
        rejectAction("packageBlocked");
        return;
      }
      if (!plan.execution.available) {
        rejectAction(plan.execution.blockedReasonKey || "artifactUnverified");
        return;
      }
      if (executedDigest.get() === plan.digest) {
        rejectAction("alreadyExecuted");
        return;
      }
      const pending = registrationSnapshot.get();
      if (pending?.digest === plan.digest && pending.txid) {
        rejectAction("alreadyExecuted");
        return;
      }
      const configuredFactory = factoryContractFor("miniapp", TESTNET);
      if (
        plan.kind !== "miniapp" ||
        plan.network !== TESTNET ||
        plan.deploymentCall.scriptHash.toLowerCase() !== configuredFactory.toLowerCase()
      ) {
        rejectAction("registrationPlanInvalid", "error");
        return;
      }

      const snapshot: RegistrationSnapshot = {
        schema: REGISTRATION_SCHEMA,
        packageId: plan.packageId,
        digest: plan.digest,
        templateId: plan.templateId,
        network: TESTNET,
        scriptHash: plan.deploymentCall.scriptHash,
        txid: "",
        submittedAt: new Date().toISOString(),
      };
      isExecuting.set(true);
      registrationState.set("checking");
      registrationRecord.set(null);
      registrationReadError.set("");
      lastError.set("");
      let invocationStarted = false;
      try {
        const livePresence = await resolveArtifactPresence(
          plan.templateId,
          configuredFactory,
          true,
        );
        if (livePresence === "unknown") {
          throw new Error(ctx.t("templateVerificationRequired"));
        }
        if (livePresence === "not-registered") {
          throw new Error(ctx.t("templateNotRegistered"));
        }
        // Persist the exact intent before opening the wallet so a reload during
        // approval never loses which package may have been submitted.
        persistRegistration(snapshot);
        registrationState.set("submitting");
        await ctx.framework.chain.ensureWallet();
        const walletNetwork = detectedNetwork(await ctx.framework.chain.detectNetwork());
        if (walletNetwork !== TESTNET) throw new Error(ctx.t("testnetRequired"));

        invocationStarted = true;
        const result = await ctx.framework.platformFactory.executeDeploymentCall(
          plan.network,
          plan.deploymentCall,
          { waitForEvent: plan.execution.confirmingEvent },
        );
        if (!result.txid) throw new Error(ctx.t("registrationTxMissing"));

        const submitted = { ...snapshot, txid: result.txid.toLowerCase() };
        lastTxid.set(submitted.txid);
        executedDigest.set(plan.digest);
        registrationState.set("submitted");
        persistRegistration(submitted);
        ctx.setStatus(ctx.t("registrationSubmitted"), "success");
        await recoverRegistration(submitted);
        void loadDeployments();
      } catch (error) {
        const message = friendlyError(error, ctx.t, "registrationFailed");
        lastError.set(message);
        const persisted = registrationSnapshot.get();
        if (persisted?.digest === plan.digest && persisted.txid) {
          registrationState.set("submitted");
        } else if (invocationStarted && message !== ctx.t("walletCancelled")) {
          registrationState.set("uncertain");
        } else {
          registrationState.set("idle");
          if (persisted?.digest === plan.digest && !persisted.txid) {
            registrationSnapshot.set(null);
            ctx.framework.storage.local.delete(REGISTRATION_STORAGE_KEY);
          }
        }
        ctx.setStatus(message, "error");
      } finally {
        isExecuting.set(false);
      }
    });

    ctx.framework.actions.register("ensureArtifactState", async (...args: unknown[]) => {
      const input = isRecord(args[0]) ? args[0] : {};
      const templateId = text(input.templateId, 120);
      if (!templateId) return;
      await resolveArtifactPresence(
        templateId,
        text(input.scriptHash, 48) || factoryContractFor("miniapp", TESTNET),
      );
    });

    ctx.framework.actions.register("refreshDeployments", () => loadDeployments());

    ctx.framework.actions.register("recoverLastRegistration", async () => {
      const snapshot = registrationSnapshot.get();
      if (!snapshot) return;
      await recoverRegistration(snapshot);
    });

    const loadData = async () => {
      try {
        const saved = ctx.framework.storage.local.get<unknown>(DRAFT_STORAGE_KEY, null);
        const draft = parseStoredMiniAppDraft(saved, initialDraft);
        if (draft) {
          restoredDraft.set(draft);
          draftJournalState.set("restored");
        } else {
          if (isRecord(saved) && saved.schema !== MINIAPP_DRAFT_SCHEMA) {
            ctx.framework.storage.local.delete(DRAFT_STORAGE_KEY);
          }
          draftJournalState.set("ready");
        }
      } catch {
        draftJournalState.set("unavailable");
      }

      const savedRegistration = parseRegistrationSnapshot(
        ctx.framework.storage.local.get<unknown>(REGISTRATION_STORAGE_KEY, null),
      );
      if (savedRegistration) {
        registrationSnapshot.set(savedRegistration);
        lastTxid.set(savedRegistration.txid);
      }

      await Promise.allSettled([
        loadDeployments(),
        savedRegistration ? recoverRegistration(savedRegistration) : Promise.resolve(),
      ]);
    };

    const cleanup = () => {
      disposed = true;
      feeEstimateToken += 1;
      // reset() joins the cell's epoch, so an in-flight deployments load at
      // dispose time can never publish — the cell-owned equivalent of the
      // legacy deploymentsToken bump.
      deploymentsCell.reset();
      registrationToken += 1;
    };

    return {
      state: {
        currentPlan,
        planStatus,
        shortDigest,
        blockingIssueCount,
        generatedCount,
        signatureState,
        walletSignature,
        walletSignatureInfo,
        isSigning,
        isGenerating,
        isExecuting,
        lastError,
        lastTxid,
        executedDigest,
        feeEstimateGas,
        artifactPresence,
        deployments,
        deploymentsTotal,
        deploymentsState,
        walletAddress: ctx.framework.chain.address,
        restoredDraft,
        draftJournalState,
        registrationState,
        registrationSnapshot,
        registrationRecord,
        registrationReadError,
      },
      loadData,
      cleanup,
    };
  };
}
