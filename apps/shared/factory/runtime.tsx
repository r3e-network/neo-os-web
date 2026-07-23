import type { ComponentType } from "react";
import { createObservable, type MiniAppSetupContext, type MiniAppSetupResult, type PlayAreaProps } from "@shared/react/defineMiniApp";
import { createDerived, createReadCell } from "@shared/react/context";
import { FactoryPlayArea } from "./FactoryPlayArea";
import {
  buildFactoryPlan,
  createFactoryDraftFromLaunchContext,
  factoryContractFor,
  type FactoryArtifactDeploymentSupport,
  type FactoryArtifactPresence,
  type FactoryKind,
  type FactoryNetwork,
  type FactoryPlan,
} from "./factoryPlan";
import {
  estimateFactoryFeeGas,
  fetchFactoryArtifactDeploymentSupport,
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
    // The deployments read lane on the platform read-cell (read-cell adoption):
    // one cell owns the {items,total} registry snapshot plus the "have we asked
    // yet?" status. The cell's status union is the legacy state union verbatim
    // ("idle" | "loading" | "ready" | "error"), its epoch replaces the
    // hand-rolled deploymentsToken (last-write-wins on overlapping loads), and
    // a failed read keeps the last good snapshot renderable — identical
    // keep-last-good-on-error semantics to the replaced plumbing.
    let deploymentsNetwork: FactoryNetwork = initialNetwork;
    const deploymentsCell = createReadCell(
      async (): Promise<{ items: FactoryDeploymentItem[]; total: number }> => {
        const network = deploymentsNetwork;
        const scriptHash = factoryContractFor(kind, network);
        const { total, items } = await fetchFactoryDeployments(
          network,
          scriptHash,
          kind,
          DEPLOYMENTS_PAGE_SIZE,
        );
        return { items, total };
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

    const presenceCache = new Map<string, { presence: FactoryArtifactPresence; at: number }>();
    const deploymentSupportCache = new Map<
      string,
      { support: FactoryArtifactDeploymentSupport; at: number }
    >();
    let feeEstimateToken = 0;

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

    async function resolveArtifactDeploymentSupport(
      network: FactoryNetwork,
      scriptHash: string,
    ): Promise<FactoryArtifactDeploymentSupport> {
      const key = `${network}|${scriptHash}`;
      const cached = deploymentSupportCache.get(key);
      if (cached && Date.now() - cached.at < ARTIFACT_CACHE_TTL_MS) {
        return cached.support;
      }
      const support = scriptHash
        ? await fetchFactoryArtifactDeploymentSupport(network, scriptHash)
        : "unknown";
      if (support !== "unknown") {
        deploymentSupportCache.set(key, { support, at: Date.now() });
      }
      return support;
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
      deploymentsNetwork = network;
      // Failures surface as deploymentsState === "error" on the cell; the
      // legacy loader never rejected, so callers must not see this reject.
      await deploymentsCell.load().catch(() => {});
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
        const [presence, deploymentSupport] = await Promise.all([
          resolveArtifactPresence(
            preliminary.network,
            preliminary.templateId,
            preliminary.deploymentCall.scriptHash,
          ),
          kind === "miniapp"
            ? Promise.resolve<FactoryArtifactDeploymentSupport>("supported")
            : resolveArtifactDeploymentSupport(
                preliminary.network,
                preliminary.deploymentCall.scriptHash,
              ),
        ]);
        const plan = buildFactoryPlan(kind, form, {
          appId,
          artifactPresence: presence,
          artifactDeploymentSupport: deploymentSupport,
        });
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

    ctx.framework.actions.register("discardPlan", async () => {
      // Any edit after a plan has been generated changes the committed input
      // set. Drop the stale package and its signature immediately so the UI
      // can never sign or execute values that no longer match the visible
      // draft. Keep executedDigest as the replay guard for packages that were
      // already submitted.
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
      lastTxid.set("");
      deployedContractHash.set("");
      ctx.clearStatus();
    });

    ctx.framework.actions.register("signCurrentPlan", async () => {
      const plan = currentPlan.get();
      if (!plan) throw new Error(ctx.t("noPlanToSign"));
      if (!plan.publishable) throw new Error(ctx.t("packageBlocked"));

      isSigning.set(true);
      lastError.set("");
      try {
        const message = `${templateLabel(kind)} Factory template plan\n${plan.digest}\n${plan.packageId}\n${plan.artifactDigest}`;
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
        const result = await ctx.framework.platformFactory.executeDeploymentCall(
          plan.network,
          plan.deploymentCall,
          { waitForEvent: plan.execution.confirmingEvent },
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
