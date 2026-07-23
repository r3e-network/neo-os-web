import type {
  MiniAppSetupContext,
  MiniAppSetupResult,
  Observable,
} from "@shared/react/defineMiniApp";
import { createObservable } from "@shared/react/defineMiniApp";
import {
  createFactorySetup,
  type FactorySignatureInfo,
} from "@shared/factory/runtime";
import type { FactoryPlan } from "@shared/factory/factoryPlan";
import {
  buildFactoryArtifactCall,
  factoryTemplateArtifactHashes,
} from "@shared/factory/factoryArtifact";
import { sha256 } from "@shared/shims/noble-hashes-sha256.js";
import { normalizeScriptHash, ownerMatchesAddress } from "@shared/utils/neo";
import type { MiniAppLaunchContext } from "@shared/utils/launch-params";
import {
  createUncheckedMetadataVerification,
  verifyNftMetadataOrigin,
  type NftMetadataVerification,
  type NftMetadataVerificationStatus,
} from "./nft-factory-metadata";

export const NFT_FACTORY_APP_ID = "miniapp-nft-factory";
export const NFT_FACTORY_TEMPLATE_ID = "tpl.nep11.collection.v1";
export const NFT_FACTORY_TESTNET_CONTRACT =
  "0x03a7c8fc724a575ee739c919ed52cb5e2a2bdc49";
export const NFT_FACTORY_EXECUTION_BLOCK_REASON =
  "nftDeploymentCertificationPending";
export const NFT_FACTORY_SUPPORTED_NETWORKS = ["neo-n3-testnet"] as const;

const METADATA_ERROR = "metadata_sample_unverified";
const FACTORY_TEMPLATE_ERROR = "factory_template_unverified";
const CANONICAL_PLAN_ERROR = "canonical_nft_factory_plan";

type ActionHandler = (...args: unknown[]) => unknown | Promise<unknown>;

export interface NftFactorySetupOptions {
  metadataVerifier?: typeof verifyNftMetadataOrigin;
}

/**
 * The shared factory seed used to point at a demonstration metadata host that
 * now returns HTTP 404. Start NFT Factory with an intentionally empty origin
 * unless OneGate/the user supplied one, so a dead example URL can never enter
 * a signed package by accident.
 */
export function withNftFactoryLaunchDefaults(
  context: MiniAppLaunchContext,
): MiniAppLaunchContext {
  const hasBaseUri = Object.prototype.hasOwnProperty.call(
    context.params,
    "baseUri",
  );

  return {
    ...context,
    // Only the testnet Factory is deployed/configured for this release. A
    // mainnet launch hint must not paint a selectable but unusable target.
    network: "testnet",
    params: {
      ...context.params,
      network: "testnet",
      baseUri: hasBaseUri ? String(context.params.baseUri ?? "") : " ",
    },
    keys: [...new Set([...context.keys, "network", "baseUri"])],
    hasParams: true,
  };
}

function observableFrom<T>(
  state: MiniAppSetupResult["state"],
  key: string,
): Observable<T> {
  const value = state?.[key];
  if (!value) throw new Error(`NFT Factory setup is missing state: ${key}`);
  return value as Observable<T>;
}

/**
 * The deployed testnet MiniAppFactory does not expose the newer
 * deployArtifactFromTemplate ABI, and the registered NEP-11 template currently
 * has no artifact. A production creator-unique deployment therefore requires
 * a Factory upgrade plus transaction persistence, event confirmation, and
 * deployment-record readback certification. The shared planner already builds
 * the complete six-argument artifact call; this release still keeps writes closed.
 */
export function enforceNftFactoryExecutionGate(plan: FactoryPlan): FactoryPlan {
  if (plan.kind !== "nep11") return plan;

  return {
    ...plan,
    execution: {
      ...plan.execution,
      available: false,
      blockedReasonKey: NFT_FACTORY_EXECUTION_BLOCK_REASON,
    },
    steps: plan.steps.map((step) =>
      step.key === "deploy"
        ? {
            ...step,
            status: "blocked" as const,
            detailKey: "stepDeployFactoryUpgradeRequired",
          }
        : step,
    ),
  };
}

function templateWasRead(plan: FactoryPlan): boolean {
  return (
    plan.templateArtifact.status === "metadata-only" ||
    plan.templateArtifact.status === "preloaded-on-chain"
  );
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) =>
        left < right ? -1 : left > right ? 1 : 0,
      )
      .map(([key, nested]) => `${JSON.stringify(key)}:${canonicalJson(nested)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

function committedDigest(plan: FactoryPlan): string {
  const commitment = canonicalJson({
    kind: plan.kind,
    network: plan.network,
    templateId: plan.templateId,
    templateVersion: plan.templateVersion,
    artifact: {
      nefHash: plan.templateArtifact.nefHash,
      manifestHash: plan.templateArtifact.manifestHash,
      configSchemaHash: plan.templateArtifact.configSchemaHash,
    },
    operation: plan.operation,
    payload: plan.payload,
  });
  const bytes = sha256(new TextEncoder().encode(commitment));
  return `0x${Array.from(bytes, (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("")}`;
}

/**
 * NFT Factory only signs the one release identity documented in its manifest.
 * The check also proves that the plan selects the creator-artifact ABI and that
 * all six package-bound values exactly match the generated governed artifact.
 */
export function isCanonicalNftFactoryPlan(plan: FactoryPlan): boolean {
  const expectedPackageId = `${NFT_FACTORY_TEMPLATE_ID.replace(/\./g, "-")}-${plan.digest.slice(-10)}`;
  try {
    const expectedArtifact = buildFactoryArtifactCall(
      "nep11",
      plan.templateId,
      plan.packageId,
      plan.payload.initParams as Record<string, unknown>,
    );
    const expectedHashes = factoryTemplateArtifactHashes("nep11");
    return (
      plan.kind === "nep11" &&
      plan.network === "neo-n3-testnet" &&
      plan.templateId === NFT_FACTORY_TEMPLATE_ID &&
      plan.templateVersion === "1.0.0" &&
      plan.templateRef === NFT_FACTORY_TEMPLATE_ID &&
      plan.operation === "prepareNEP11" &&
      plan.payload.standard === "NEP-11" &&
      plan.payload.templateId === plan.templateId &&
      plan.payload.templateVersion === plan.templateVersion &&
      plan.templateArtifact.nefHash === expectedHashes.nefHash &&
      plan.templateArtifact.manifestHash === expectedHashes.manifestHash &&
      /^0x[0-9a-f]{64}$/.test(plan.digest) &&
      plan.digest === committedDigest(plan) &&
      plan.packageId === expectedPackageId &&
      normalizeScriptHash(plan.deploymentCall.scriptHash) ===
        NFT_FACTORY_TESTNET_CONTRACT &&
      plan.deploymentCall.operation === "deployArtifactFromTemplate" &&
      plan.artifactDigest === expectedArtifact.artifactDigest &&
      canonicalJson(plan.deploymentCall.args) === canonicalJson(expectedArtifact.args)
    );
  } catch {
    return false;
  }
}

/**
 * Exact owner-wallet payload. Besides the deterministic plan digest, it binds
 * the canonical network, Factory contract, template and canonical payload so
 * the signed commitment can be compared directly with the exported package.
 */
export function buildNftFactorySignatureMessage(plan: FactoryPlan): string {
  return [
    "NFT Factory collection commitment v1",
    `network=${plan.network}`,
    `factory=${normalizeScriptHash(plan.deploymentCall.scriptHash)}`,
    `template=${plan.templateId}@${plan.templateVersion}`,
    `package=${plan.packageId}`,
    `digest=${plan.digest}`,
    `artifact=${plan.artifactDigest}`,
    `payload=${canonicalJson(plan.payload)}`,
  ].join("\n");
}

/**
 * A package can always be copied for offline review, but owner signing is only
 * offered after both the selected Factory template and token #1 metadata sample
 * have been read successfully. Neither read is confused with upload or pinning.
 */
export function enforceNftFactorySigningReadiness(
  plan: FactoryPlan,
  metadata: NftMetadataVerification,
): FactoryPlan {
  const gated = enforceNftFactoryExecutionGate(plan);
  const blockingErrors = [...gated.blockingErrors];
  if (!isCanonicalNftFactoryPlan(gated)) {
    blockingErrors.push(CANONICAL_PLAN_ERROR);
  }
  const metadataSyntaxAlreadyBlocked = blockingErrors.includes(
    "base_uri_https_trailing_slash",
  );
  if (!metadataSyntaxAlreadyBlocked && metadata.status !== "verified") {
    blockingErrors.push(METADATA_ERROR);
  }
  if (!templateWasRead(gated)) blockingErrors.push(FACTORY_TEMPLATE_ERROR);
  const uniqueErrors = [...new Set(blockingErrors)];
  const addedMetadataBlock = uniqueErrors.includes(METADATA_ERROR);
  const addedTemplateBlock = uniqueErrors.includes(FACTORY_TEMPLATE_ERROR);
  const addedCanonicalBlock = uniqueErrors.includes(CANONICAL_PLAN_ERROR);

  return {
    ...gated,
    publishable:
      gated.publishable &&
      !addedMetadataBlock &&
      !addedTemplateBlock &&
      !addedCanonicalBlock,
    blockingErrors: uniqueErrors,
    steps: gated.steps.map((step) => {
      if (step.key === "validate" && addedCanonicalBlock) {
        return {
          ...step,
          status: "blocked" as const,
          detailKey: "canonicalPlanMismatch",
        };
      }
      if (step.key === "validate" && addedMetadataBlock) {
        return {
          ...step,
          status: "blocked" as const,
          detailKey: "metadataSampleUnverified",
        };
      }
      if (step.key === "template" && addedTemplateBlock) {
        return {
          ...step,
          status: "blocked" as const,
          detailKey: "factoryTemplateUnverified",
        };
      }
      return step;
    }),
  };
}

function normalizeDetectedNetwork(value: unknown): FactoryPlan["network"] | null {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "testnet" || normalized === "neo-n3-testnet") {
    return "neo-n3-testnet";
  }
  if (normalized === "mainnet" || normalized === "neo-n3-mainnet") {
    return "neo-n3-mainnet";
  }
  return null;
}

/**
 * App-owned production gate around the shared collection planner.
 *
 * NFT Factory can still validate, live-check template metadata, export a
 * deterministic package, and collect an owner signature. It cannot submit a
 * transaction until the UI can generate and bind the creator-specific NEF +
 * manifest required by the live Factory ABI.
 */
export function createNftFactorySetupWithOptions(
  { metadataVerifier = verifyNftMetadataOrigin }: NftFactorySetupOptions = {},
) {
  return async function setup(
    ctx: MiniAppSetupContext,
  ): Promise<MiniAppSetupResult> {
    const baseSetup = createFactorySetup("nep11", NFT_FACTORY_APP_ID);
    const captured = new Map<string, ActionHandler>();
    const actions = ctx.framework.actions;
    const originalRegister = actions.register;

    actions.register = ((
      key: string,
      handler: ActionHandler,
      options?: Parameters<typeof originalRegister>[2],
    ) => {
      captured.set(key, handler);
      return originalRegister.call(actions, key, handler, options);
    }) as typeof actions.register;

    let result: MiniAppSetupResult;
    try {
      result = await baseSetup({
        ...ctx,
        launchContext: withNftFactoryLaunchDefaults(ctx.launchContext),
      });
    } finally {
      actions.register = originalRegister;
    }

    const currentPlan = observableFrom<FactoryPlan | null>(
      result.state,
      "currentPlan",
    );
    const lastError = observableFrom<string>(result.state, "lastError");
    const feeEstimateGas = observableFrom<string>(
      result.state,
      "feeEstimateGas",
    );
    const planStatus = observableFrom<string>(result.state, "planStatus");
    const blockingIssueCount = observableFrom<number>(
      result.state,
      "blockingIssueCount",
    );
    const signatureState = observableFrom<string>(
      result.state,
      "signatureState",
    );
    const isSigning = observableFrom<boolean>(result.state, "isSigning");
    const isGenerating = observableFrom<boolean>(result.state, "isGenerating");
    const walletSignature = observableFrom<string>(
      result.state,
      "walletSignature",
    );
    const walletSignatureInfo = observableFrom<FactorySignatureInfo | null>(
      result.state,
      "walletSignatureInfo",
    );
    const metadataStatus = createObservable<NftMetadataVerificationStatus>(
      "not-checked",
    );
    const metadataDetailKey = createObservable("metadataNotChecked");
    const metadataSampleUrl = createObservable("");
    const metadataSampleName = createObservable("");
    const metadataSampleImage = createObservable("");
    const metadataCheckedAt = createObservable(0);
    const baseGenerate = captured.get("generatePlan");
    const baseDiscard = captured.get("discardPlan");

    if (!baseGenerate || !baseDiscard) {
      throw new Error("NFT Factory could not attach the shared planning actions");
    }

    let metadataGeneration = 0;
    let walletGeneration = 0;
    let disposed = false;

    const clearSignature = () => {
      walletSignature.set("");
      walletSignatureInfo.set(null);
      signatureState.set(ctx.t("unsigned"));
    };

    const fail = (key: string): never => {
      const message = ctx.t(key);
      lastError.set(message);
      throw new Error(message);
    };

    const applyMetadataState = (verification: NftMetadataVerification) => {
      metadataStatus.set(verification.status);
      metadataDetailKey.set(verification.detailKey);
      metadataSampleUrl.set(verification.sampleUrl);
      metadataSampleName.set(verification.name ?? "");
      metadataSampleImage.set(verification.image ?? "");
      metadataCheckedAt.set(verification.checkedAt);
    };

    actions.register("generatePlan", async (...args: unknown[]) => {
      if (isGenerating.get()) return;
      const token = ++metadataGeneration;
      const form = (args[0] ?? {}) as Record<string, unknown>;
      metadataStatus.set("checking");
      metadataDetailKey.set("metadataChecking");
      metadataSampleUrl.set("");
      metadataSampleName.set("");
      metadataSampleImage.set("");
      metadataCheckedAt.set(0);

      const verificationPromise = metadataVerifier(form.baseUri).catch(() => ({
        ...createUncheckedMetadataVerification(),
        status: "unavailable" as const,
        detailKey: "metadataSampleUnavailable" as const,
        checkedAt: Date.now(),
      }));
      const [, verification] = await Promise.all([
        baseGenerate(...args),
        verificationPromise,
      ]);

      if (disposed || token !== metadataGeneration) {
        if (!disposed) await baseDiscard();
        return;
      }

      applyMetadataState(verification);
      const sharedPlan = currentPlan.get();
      if (!sharedPlan) return;
      const plan = enforceNftFactorySigningReadiness(sharedPlan, verification);
      currentPlan.set(plan);
      planStatus.set(
        plan.publishable ? ctx.t("packageReady") : ctx.t("packageBlocked"),
      );
      blockingIssueCount.set(plan.blockingErrors.length);
      feeEstimateGas.set("");
      ctx.setStatus(
        plan.publishable ? ctx.t("packageReady") : ctx.t("packageBlocked"),
        plan.publishable ? "success" : "warning",
      );
    });

    actions.register("discardPlan", async () => {
      metadataGeneration += 1;
      await baseDiscard();
      applyMetadataState(createUncheckedMetadataVerification());
    });

    actions.register("signCurrentPlan", async () => {
      if (isSigning.get()) return;
      const plan = currentPlan.get();
      if (!plan) return fail("noPlanToSign");
      if (metadataStatus.get() !== "verified") {
        fail("metadataVerificationRequired");
      }
      if (!templateWasRead(plan)) fail("factoryTemplateUnverified");
      if (!plan.publishable) fail("packageBlocked");
      if (!isCanonicalNftFactoryPlan(plan)) fail("canonicalPlanMismatch");

      const message = buildNftFactorySignatureMessage(plan);
      const existing = walletSignatureInfo.get();
      if (existing?.signature && existing.message === message) {
        ctx.setStatus(ctx.t("planSigned"), "success");
        return;
      }

      const generation = walletGeneration;
      isSigning.set(true);
      lastError.set("");
      try {
        const ensured = String(
          (await ctx.framework.chain.ensureWallet()) ?? "",
        ).trim();
        const connected =
          String(ctx.framework.chain.address.get() ?? "").trim() || ensured;
        if (!ownerMatchesAddress(plan.execution.signerHint, connected)) {
          fail("ownerWalletRequired");
        }

        const detectedBefore = normalizeDetectedNetwork(
          await ctx.framework.chain.detectNetwork(),
        );
        if (!detectedBefore) fail("walletNetworkUnknown");
        if (detectedBefore !== plan.network) fail("walletNetworkMismatch");

        const signed = await ctx.services.chain.signMessage(message);
        const record =
          signed && typeof signed === "object"
            ? (signed as Record<string, unknown>)
            : null;
        const signature =
          typeof signed === "string"
            ? signed.trim()
            : typeof record?.signature === "string"
              ? record.signature.trim()
              : typeof record?.data === "string"
                ? record.data.trim()
                : "";
        const publicKey =
          typeof record?.publicKey === "string"
            ? record.publicKey.trim()
            : typeof record?.publicKeyHash === "string"
              ? record.publicKeyHash.trim()
              : typeof record?.pubkey === "string"
                ? record.pubkey.trim()
                : "";
        if (!signature) fail("signFailed");

        const detectedAfter = normalizeDetectedNetwork(
          await ctx.framework.chain.detectNetwork(),
        );
        const connectedAfter = String(
          ctx.framework.chain.address.get() ?? ensured,
        ).trim();
        const activePlan = currentPlan.get();
        if (
          generation !== walletGeneration ||
          !ownerMatchesAddress(connected, connectedAfter) ||
          detectedAfter !== plan.network ||
          !activePlan ||
          activePlan.digest !== plan.digest ||
          !activePlan.publishable ||
          !isCanonicalNftFactoryPlan(activePlan) ||
          buildNftFactorySignatureMessage(activePlan) !== message
        ) {
          clearSignature();
          fail(
            !activePlan || activePlan.digest !== plan.digest ||
              !activePlan.publishable ||
              !isCanonicalNftFactoryPlan(activePlan) ||
              buildNftFactorySignatureMessage(activePlan) !== message
              ? "planChangedDuringSigning"
              : "walletChangedDuringSigning",
          );
        }

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
        if (!lastError.get()) lastError.set(ctx.t("signFailed"));
        throw error;
      } finally {
        isSigning.set(false);
      }
    });

    actions.register("executePlan", async () => {
      fail(NFT_FACTORY_EXECUTION_BLOCK_REASON);
    });

    const stopWalletWatch = ctx.framework.wallet.onAccountChanged(() => {
      walletGeneration += 1;
      clearSignature();
    });
    const stopMisleadingFee = feeEstimateGas.subscribe(() => {
      if (currentPlan.get()?.kind === "nep11" && feeEstimateGas.get()) {
        feeEstimateGas.set("");
      }
    });
    const baseCleanup = result.cleanup;

    return {
      ...result,
      state: {
        ...result.state,
        metadataStatus,
        metadataDetailKey,
        metadataSampleUrl,
        metadataSampleName,
        metadataSampleImage,
        metadataCheckedAt,
      },
      cleanup: () => {
        disposed = true;
        metadataGeneration += 1;
        walletGeneration += 1;
        stopWalletWatch();
        stopMisleadingFee();
        baseCleanup?.();
      },
    };
  };
}

export const createNftFactorySetup = createNftFactorySetupWithOptions();
