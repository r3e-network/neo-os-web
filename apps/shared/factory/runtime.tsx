import type { ComponentType } from "react";
import { createObservable, type MiniAppSetupContext, type MiniAppSetupResult, type PlayAreaProps } from "@shared/react/defineMiniApp";
import { FactoryPlayArea } from "./FactoryPlayArea";
import {
  buildFactoryPlan,
  createFactoryDraftFromLaunchContext,
  type FactoryKind,
  type FactoryPlan,
} from "./factoryPlan";

function templateLabel(kind: FactoryKind): string {
  if (kind === "nep11") return "NEP-11";
  if (kind === "miniapp") return "MiniApp";
  return "NEP-17";
}

export function createFactoryPlayArea(kind: FactoryKind, appId: string): ComponentType<PlayAreaProps> {
  return function DomainFactoryPlayArea(props: PlayAreaProps) {
    return <FactoryPlayArea {...props} fixedKind={kind} appId={appId} />;
  };
}

export function createFactorySetup(kind: FactoryKind, appId: string) {
  return function setup(ctx: MiniAppSetupContext): MiniAppSetupResult {
    const initialDraft = createFactoryDraftFromLaunchContext(ctx.launchContext, kind);
    const currentPlan = createObservable<FactoryPlan | null>(null);
    const activeKind = createObservable<FactoryKind>(kind);
    const activeTemplateLabel = createObservable(templateLabel(kind));
    const targetNetwork = createObservable(
      initialDraft[kind].network === "neo-n3-mainnet" ? "mainnet" : "testnet",
    );
    const planStatus = createObservable(ctx.t("packageBlocked"));
    const shortDigest = createObservable("-");
    const blockingIssueCount = createObservable(0);
    const generatedCount = createObservable(0);
    const signatureState = createObservable(ctx.t("unsigned"));
    const walletSignature = createObservable("");
    const isSigning = createObservable(false);
    const lastError = createObservable("");

    function applyPlan(plan: FactoryPlan) {
      currentPlan.set(plan);
      activeKind.set(plan.kind);
      activeTemplateLabel.set(templateLabel(plan.kind));
      targetNetwork.set(plan.network === "neo-n3-mainnet" ? "mainnet" : "testnet");
      planStatus.set(plan.publishable ? ctx.t("packageReady") : ctx.t("packageBlocked"));
      shortDigest.set(plan.digest.slice(-10));
      blockingIssueCount.set(plan.blockingErrors.length);
      generatedCount.set(generatedCount.get() + 1);
      signatureState.set(ctx.t("unsigned"));
      walletSignature.set("");
      lastError.set("");
    }

    ctx.registerAction("generatePlan", async (...args: unknown[]) => {
      const form = (args[0] || {}) as Record<string, unknown>;
      const plan = buildFactoryPlan(kind, form, { appId });
      applyPlan(plan);
      ctx.setStatus(
        plan.publishable ? ctx.t("packageReady") : ctx.t("packageBlocked"),
        plan.publishable ? "success" : "warning",
      );
    });

    ctx.registerAction("signCurrentPlan", async () => {
      const plan = currentPlan.get();
      if (!plan) throw new Error(ctx.t("noPlanToSign"));
      if (!plan.publishable) throw new Error(ctx.t("packageBlocked"));

      isSigning.set(true);
      lastError.set("");
      try {
        const signature = await ctx.services.chain.signMessage(
          `${templateLabel(kind)} Factory template plan\n${plan.digest}\n${plan.packageId}`,
        );
        walletSignature.set(typeof signature === "string" ? signature : JSON.stringify(signature ?? {}));
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
        isSigning,
        lastError,
      },
    };
  };
}
