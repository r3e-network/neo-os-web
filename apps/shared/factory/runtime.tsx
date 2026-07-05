import type { ComponentType } from "react";
import { createObservable, type MiniAppSetupContext, type MiniAppSetupResult, type PlayAreaProps } from "@shared/react/defineMiniApp";
import { FactoryPlayArea } from "./FactoryPlayArea";
import {
  buildFactoryPlan,
  createFactoryDraftFromLaunchContext,
  factoryContractFor,
  type FactoryArtifactPresence,
  type FactoryKind,
  type FactoryNetwork,
  type FactoryPlan,
} from "./factoryPlan";
import {
  estimateFactoryFeeGas,
  fetchFactoryDeployments,
  fetchTemplateArtifactPresence,
  readFactoryRecord,
  type FactoryDeploymentItem,
} from "./factoryChain";

const ARTIFACT_CACHE_TTL_MS = 60_000;
const DEPLOYMENTS_PAGE_SIZE = 8;

function templateLabel(kind: FactoryKind): string {
  if (kind === "nep11") return "NEP-11";
  if (kind === "miniapp") return "MiniApp";
  return "NEP-17";
}

export interface FactorySignatureInfo {
  signature: string;
  publicKey: string;
  message: string;
  signedAt: string;
}

export function createFactoryPlayArea(kind: FactoryKind, appId: string): ComponentType<PlayAreaProps> {
  return function DomainFactoryPlayArea(props: PlayAreaProps) {
    return <FactoryPlayArea {...props} fixedKind={kind} appId={appId} />;
  };
}

export function createFactorySetup(kind: FactoryKind, appId: string) {
  return function setup(ctx: MiniAppSetupContext): MiniAppSetupResult {
    const initialDraft = createFactoryDraftFromLaunchContext(ctx.launchContext, kind);
    const initialNetwork = initialDraft[kind].network;
    const currentPlan = createObservable<FactoryPlan | null>(null);
    const activeKind = createObservable<FactoryKind>(kind);
    const activeTemplateLabel = createObservable(templateLabel(kind));
    const targetNetwork = createObservable(
      initialNetwork === "neo-n3-mainnet" ? "mainnet" : "testnet",
    );
    const planStatus = createObservable(ctx.t("packageBlocked"));
    const shortDigest = createObservable("-");
    const blockingIssueCount = createObservable(0);
    const generatedCount = createObservable(0);
    const signatureState = createObservable(ctx.t("unsigned"));
    const walletSignature = createObservable("");
    const walletSignatureInfo = createObservable<FactorySignatureInfo | null>(null);
    const isSigning = createObservable(false);
    const isGenerating = createObservable(false);
    const isExecuting = createObservable(false);
    const lastError = createObservable("");
    const lastTxid = createObservable("");
    const deployedContractHash = createObservable("");
    const executedDigest = createObservable("");
    const feeEstimateGas = createObservable("");
    // Live artifact presence per `${network}|${templateId}` so the preview
    // and the stored plan can both render honest template-artifact states.
    const artifactPresence = createObservable<Record<string, FactoryArtifactPresence>>({});
    const deployments = createObservable<FactoryDeploymentItem[]>([]);
    const deploymentsTotal = createObservable(0);
    const deploymentsState = createObservable<"idle" | "loading" | "ready" | "error">("idle");

    const presenceCache = new Map<string, { presence: FactoryArtifactPresence; at: number }>();
    let feeEstimateToken = 0;
    let deploymentsToken = 0;

    function presenceKey(network: FactoryNetwork, templateId: string): string {
      return `${network}|${templateId}`;
    }

    async function resolveArtifactPresence(
      network: FactoryNetwork,
      templateId: string,
      scriptHash: string,
    ): Promise<FactoryArtifactPresence> {
      const key = presenceKey(network, templateId);
      const cached = presenceCache.get(key);
      if (cached && Date.now() - cached.at < ARTIFACT_CACHE_TTL_MS) {
        return cached.presence;
      }
      const presence = scriptHash
        ? await fetchTemplateArtifactPresence(network, scriptHash, templateId)
        : "unknown";
      // "unknown" means the chain could not be read — never cache it, so the
      // next attempt retries instead of pinning a stale failure for the TTL.
      if (presence !== "unknown") {
        presenceCache.set(key, { presence, at: Date.now() });
      }
      artifactPresence.set({ ...artifactPresence.get(), [key]: presence });
      return presence;
    }

    function refreshFeeEstimate(plan: FactoryPlan): void {
      const token = ++feeEstimateToken;
      feeEstimateGas.set("");
      if (!plan.publishable || !plan.execution.available) return;
      const signer = ctx.services.chain.address.get() || plan.execution.signerHint;
      if (!signer) return;
      void estimateFactoryFeeGas(plan.network, plan.deploymentCall, signer).then((estimate) => {
        if (token === feeEstimateToken) feeEstimateGas.set(estimate);
      });
    }

    async function loadDeployments(network: FactoryNetwork): Promise<void> {
      const token = ++deploymentsToken;
      deploymentsState.set("loading");
      try {
        const scriptHash = factoryContractFor(kind, network);
        const { total, items } = await fetchFactoryDeployments(
          network,
          scriptHash,
          kind,
          DEPLOYMENTS_PAGE_SIZE,
        );
        if (token !== deploymentsToken) return;
        deployments.set(items);
        deploymentsTotal.set(total);
        deploymentsState.set("ready");
      } catch {
        if (token !== deploymentsToken) return;
        deploymentsState.set("error");
      }
    }

    function activeNetwork(): FactoryNetwork {
      return currentPlan.get()?.network ?? initialNetwork;
    }

    function applyPlan(plan: FactoryPlan) {
      // Count a generated package only when it is publishable AND its
      // deterministic digest differs from the currently applied plan. Blocked
      // plans produce nothing publishable, and re-clicking "Generate" with
      // unchanged inputs reproduces the same package; neither must inflate the
      // "Generated" stat.
      const previousDigest = currentPlan.get()?.digest ?? null;
      currentPlan.set(plan);
      activeKind.set(plan.kind);
      activeTemplateLabel.set(templateLabel(plan.kind));
      targetNetwork.set(plan.network === "neo-n3-mainnet" ? "mainnet" : "testnet");
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
      if (plan.digest !== previousDigest) {
        lastTxid.set("");
        deployedContractHash.set("");
      }
    }

    ctx.framework.actions.register("generatePlan", async (...args: unknown[]) => {
      if (isGenerating.get()) return;
      isGenerating.set(true);
      try {
        const form = (args[0] || {}) as Record<string, unknown>;
        // First pass resolves template id + factory contract for the inputs;
        // the live artifact check then feeds the honest second pass. The
        // digest is independent of the live status, so both passes commit to
        // the same package id.
        const preliminary = buildFactoryPlan(kind, form, { appId });
        const presence = await resolveArtifactPresence(
          preliminary.network,
          preliminary.templateId,
          preliminary.deploymentCall.scriptHash,
        );
        const plan = buildFactoryPlan(kind, form, { appId, artifactPresence: presence });
        applyPlan(plan);
        refreshFeeEstimate(plan);
        ctx.setStatus(
          plan.publishable ? ctx.t("packageReady") : ctx.t("packageBlocked"),
          plan.publishable ? "success" : "warning",
        );
      } finally {
        isGenerating.set(false);
      }
    });

    ctx.framework.actions.register("signCurrentPlan", async () => {
      const plan = currentPlan.get();
      if (!plan) throw new Error(ctx.t("noPlanToSign"));
      if (!plan.publishable) throw new Error(ctx.t("packageBlocked"));

      isSigning.set(true);
      lastError.set("");
      try {
        const message = `${templateLabel(kind)} Factory template plan\n${plan.digest}\n${plan.packageId}`;
        const signed = await ctx.services.chain.signMessage(message);
        const signature =
          typeof signed === "string"
            ? signed
            : String(signed?.data ?? "") || JSON.stringify(signed ?? {});
        const publicKey = typeof signed === "object" && signed !== null
          ? String(signed.publicKey ?? "")
          : "";
        walletSignature.set(signature);
        walletSignatureInfo.set({
          signature,
          publicKey,
          message,
          signedAt: new Date().toISOString(),
        });
        signatureState.set(ctx.t("signed"));
        ctx.setStatus(ctx.t("planSigned"), "success");
      } catch (error) {
        const message = error instanceof Error ? error.message : ctx.t("signFailed");
        lastError.set(message);
        throw error;
      } finally {
        isSigning.set(false);
      }
    });

    ctx.framework.actions.register("executePlan", async () => {
      if (isExecuting.get()) return;
      const plan = currentPlan.get();
      if (!plan) throw new Error(ctx.t("noPlanToSign"));
      if (!plan.publishable) throw new Error(ctx.t("packageBlocked"));
      if (!plan.execution.available) {
        throw new Error(ctx.t(plan.execution.blockedReasonKey || "artifactUnverified"));
      }
      if (executedDigest.get() === plan.digest) {
        throw new Error(ctx.t("alreadyExecuted"));
      }

      isExecuting.set(true);
      lastError.set("");
      try {
        const result = await ctx.services.chain.invoke(
          plan.deploymentCall.operation,
          plan.deploymentCall.args,
          {
            scriptHash: plan.deploymentCall.scriptHash,
            waitForEvent: plan.execution.confirmingEvent,
          },
        );
        if (!result.txid) throw new Error(ctx.t("executeFailed"));
        lastTxid.set(result.txid);
        executedDigest.set(plan.digest);
        // Authoritative readback: the factory record is the source of truth
        // for the deployed contract hash (event payload shapes vary by
        // indexer, the record does not).
        const record = await readFactoryRecord(
          plan.network,
          plan.deploymentCall.scriptHash,
          plan.kind,
          plan.packageId,
        );
        if (record?.deployedHash) deployedContractHash.set(record.deployedHash);
        ctx.setStatus(
          result.event || record ? ctx.t("executeConfirmed") : ctx.t("executeSubmitted"),
          "success",
        );
        void loadDeployments(plan.network);
      } catch (error) {
        const message = error instanceof Error ? error.message : ctx.t("executeFailed");
        lastError.set(message);
        throw error;
      } finally {
        isExecuting.set(false);
      }
    });

    // Background refresh used by the PlayArea when the form's template or
    // network changes before a plan is generated. Never throws — failures
    // surface as the "unverified" presence state, not an error toast.
    ctx.framework.actions.register("ensureArtifactState", async (...args: unknown[]) => {
      const input = (args[0] || {}) as { templateId?: string; network?: string; scriptHash?: string };
      const network: FactoryNetwork = input.network === "neo-n3-mainnet" ? "neo-n3-mainnet" : "neo-n3-testnet";
      const templateId = String(input.templateId ?? "");
      if (!templateId) return;
      await resolveArtifactPresence(network, templateId, String(input.scriptHash ?? ""));
    });

    ctx.framework.actions.register("refreshDeployments", async (...args: unknown[]) => {
      const input = (args[0] || {}) as { network?: string };
      const network: FactoryNetwork = input.network === "neo-n3-mainnet"
        ? "neo-n3-mainnet"
        : input.network === "neo-n3-testnet"
          ? "neo-n3-testnet"
          : activeNetwork();
      await loadDeployments(network);
    });

    return {
      state: {
        currentPlan,
        activeKind,
        activeTemplateLabel,
        targetNetwork,
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
        deployedContractHash,
        executedDigest,
        feeEstimateGas,
        artifactPresence,
        deployments,
        deploymentsTotal,
        deploymentsState,
        walletAddress: ctx.services.chain.address,
      },
    };
  };
}
