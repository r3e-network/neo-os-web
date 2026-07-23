import { createObservable } from "@shared/react/defineMiniApp";
import type {
  MiniAppSetupContext,
  MiniAppSetupResult,
  Observable,
} from "@shared/react/defineMiniApp";
import { ownerMatchesAddress } from "@shared/utils/neo";
import {
  createFactorySetup,
  type FactorySignatureInfo,
} from "@shared/factory/runtime";
import type { FactoryDeploymentItem } from "@shared/factory/factoryChain";
import { inspectFactoryRecord } from "@shared/factory/factoryChain";
import {
  buildFactoryPlan,
  createFactoryDraftFromLaunchContext,
  type FactoryPlan,
  type Nep17Draft,
} from "@shared/factory/factoryPlan";

export const ASSET_DEPLOYMENT_WRITES_ENABLED = false;
export const ASSET_FACTORY_JOURNAL_KEY = "issuer-blueprint-v1";
const ASSET_FACTORY_JOURNAL_VERSION = 1;
const ASSET_FACTORY_NETWORK = "neo-n3-testnet" as const;
const FACTORY_CONFIGURATION_ERRORS = new Set([
  "factory_contract_not_configured",
  "factory_contract_invalid",
]);

interface AssetFactoryJournalLock {
  digest: string;
  packageId: string;
}

export interface AssetFactoryJournal {
  version: 1;
  draft: Nep17Draft;
  locked: AssetFactoryJournalLock | null;
  signatureInfo: FactorySignatureInfo | null;
  signedWalletAddress: string;
  savedAt: string;
}

export interface RestoredAssetFactoryJournal {
  draft: Nep17Draft;
  plan: FactoryPlan | null;
  signatureInfo: FactorySignatureInfo | null;
  signedWalletAddress: string;
  savedAt: string;
}

export type AssetRecoveryState =
  | "idle"
  | "checking"
  | "confirmed"
  | "record-only"
  | "unconfirmed"
  | "mismatch"
  | "unavailable";

type StateMap = Record<string, Observable>;

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function storedString(value: unknown, maxLength: number): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(0, maxLength);
}

export function normalizeAssetFactoryDraft(value: unknown): Nep17Draft | null {
  const record = asRecord(value);
  if (!record || record.network !== ASSET_FACTORY_NETWORK) return null;
  if (typeof record.mintable !== "boolean") return null;

  return {
    name: storedString(record.name, 64),
    symbol: storedString(record.symbol, 16).toUpperCase(),
    decimals: storedString(record.decimals, 4),
    initialSupply: storedString(record.initialSupply, 80),
    owner: storedString(record.owner, 64),
    treasury: storedString(record.treasury, 64),
    mintable: record.mintable,
    network: ASSET_FACTORY_NETWORK,
  };
}

export function assetFactorySignatureMessage(plan: FactoryPlan): string {
  return `NEP-17 Factory template plan\n${plan.digest}\n${plan.packageId}\n${plan.artifactDigest}`;
}

function planHasOnlyConfigurationErrors(plan: FactoryPlan): boolean {
  return plan.blockingErrors.every((error) =>
    FACTORY_CONFIGURATION_ERRORS.has(error),
  );
}

export function restoreAssetFactoryJournal(
  value: unknown,
  appId: string,
): RestoredAssetFactoryJournal | null {
  const record = asRecord(value);
  if (record?.version !== ASSET_FACTORY_JOURNAL_VERSION) return null;

  const draft = normalizeAssetFactoryDraft(record.draft);
  if (!draft) return null;

  const rebuilt = enforceAssetPlanSafety(
    buildFactoryPlan("nep17", draft as unknown as Record<string, unknown>, {
      appId,
      artifactPresence: "unknown",
    }),
  );
  const locked = asRecord(record.locked);
  const lockMatches = Boolean(
    locked &&
    locked.digest === rebuilt.digest &&
    locked.packageId === rebuilt.packageId &&
    planHasOnlyConfigurationErrors(rebuilt),
  );
  const plan = lockMatches ? rebuilt : null;

  const signedWalletAddress = storedString(record.signedWalletAddress, 64);
  const signatureRecord = asRecord(record.signatureInfo);
  const signature = storedString(signatureRecord?.signature, 8192);
  const publicKey = storedString(signatureRecord?.publicKey, 1024);
  const message =
    typeof signatureRecord?.message === "string" &&
    signatureRecord.message.length <= 512
      ? signatureRecord.message
      : "";
  const signedAt = storedString(signatureRecord?.signedAt, 64);
  const signatureMatches = Boolean(
    plan &&
    signature &&
    signedWalletAddress &&
    message === assetFactorySignatureMessage(plan) &&
    ownerMatchesAddress(plan.execution.signerHint, signedWalletAddress),
  );

  return {
    draft,
    plan,
    signatureInfo: signatureMatches
      ? { signature, publicKey, message, signedAt }
      : null,
    signedWalletAddress: signatureMatches ? signedWalletAddress : "",
    savedAt: storedString(record.savedAt, 64),
  };
}

export function createAssetFactoryJournal(
  draft: Nep17Draft,
  plan: FactoryPlan | null,
  signatureInfo: FactorySignatureInfo | null,
  signedWalletAddress: string,
  savedAt = new Date().toISOString(),
): AssetFactoryJournal {
  const rebuilt = buildFactoryPlan(
    "nep17",
    draft as unknown as Record<string, unknown>,
    {
      appId: "miniapp-asset-factory",
      artifactPresence: "unknown",
    },
  );
  const lockMatches = Boolean(
    plan &&
    plan.digest === rebuilt.digest &&
    plan.packageId === rebuilt.packageId &&
    planHasOnlyConfigurationErrors(rebuilt),
  );
  const signatureMatches = Boolean(
    lockMatches &&
    signatureInfo?.signature &&
    signatureInfo.message === assetFactorySignatureMessage(plan!) &&
    ownerMatchesAddress(plan!.execution.signerHint, signedWalletAddress),
  );

  return {
    version: ASSET_FACTORY_JOURNAL_VERSION,
    draft,
    locked: lockMatches
      ? { digest: plan!.digest, packageId: plan!.packageId }
      : null,
    signatureInfo: signatureMatches ? signatureInfo : null,
    signedWalletAddress: signatureMatches ? signedWalletAddress : "",
    savedAt,
  };
}

function stateObservable<T>(state: StateMap, key: string): Observable<T> {
  const observable = state[key];
  if (!observable) throw new Error(`Asset Factory state is missing ${key}`);
  return observable as Observable<T>;
}

/**
 * The shared planner now builds the complete creator-unique artifact call.
 * This app still keeps writes closed until the upgraded TestNet ABI and the
 * journal/event/readback lifecycle are certified end to end.
 */
export function enforceAssetPlanSafety(plan: FactoryPlan): FactoryPlan {
  return {
    ...plan,
    execution: {
      ...plan.execution,
      available: false,
      blockedReasonKey: "deploymentCertificationPending",
    },
    steps: plan.steps.map((step) =>
      step.key === "deploy"
        ? { ...step, status: "blocked", detailKey: "stepDeployFactoryUpgradeRequired" }
        : step,
    ),
  };
}

export function classifyRecoveredAsset(
  plan: FactoryPlan,
  record: FactoryDeploymentItem | null,
): AssetRecoveryState {
  if (!record) return "unconfirmed";
  if (
    record.packageId !== plan.packageId ||
    record.templateId !== plan.templateId ||
    record.digest !== plan.digest ||
    !ownerMatchesAddress(record.creator, plan.execution.signerHint)
  ) {
    return "mismatch";
  }
  return record.deployedHash ? "confirmed" : "record-only";
}

export function issuerWalletMatches(
  plan: FactoryPlan,
  wallet: string | null | undefined,
): boolean {
  return Boolean(
    wallet && ownerMatchesAddress(plan.execution.signerHint, wallet),
  );
}

export function createAssetFactorySetup(appId: string) {
  const createBaseSetup = createFactorySetup("nep17", appId);

  return function setup(ctx: MiniAppSetupContext): MiniAppSetupResult {
    const base = createBaseSetup(ctx);
    const state = (base.state ?? {}) as StateMap;
    const currentPlan = stateObservable<FactoryPlan | null>(
      state,
      "currentPlan",
    );
    const feeEstimateGas = stateObservable<string>(state, "feeEstimateGas");
    const walletSignature = stateObservable<string>(state, "walletSignature");
    const walletSignatureInfo = stateObservable<FactorySignatureInfo | null>(
      state,
      "walletSignatureInfo",
    );
    const signatureState = stateObservable<string>(state, "signatureState");
    const isSigning = stateObservable<boolean>(state, "isSigning");
    const lastError = stateObservable<string>(state, "lastError");
    const walletAddress = stateObservable<string | null>(
      state,
      "walletAddress",
    );
    const planStatus = stateObservable<string>(state, "planStatus");
    const shortDigest = stateObservable<string>(state, "shortDigest");
    const blockingIssueCount = stateObservable<number>(
      state,
      "blockingIssueCount",
    );
    const generatedCount = stateObservable<number>(state, "generatedCount");
    const launchDraft = createFactoryDraftFromLaunchContext(
      ctx.launchContext,
      "nep17",
    ).nep17;
    launchDraft.network = ASSET_FACTORY_NETWORK;
    let storedJournal: RestoredAssetFactoryJournal | null = null;
    // A first run simply has nothing saved yet — a normal, expected state, not
    // a storage failure. Only a read that actually throws proves refresh
    // recovery is unavailable; an empty read means storage is reachable, and
    // persistJournal() re-verifies every write with a readback anyway.
    let storageReachable = true;
    try {
      storedJournal = restoreAssetFactoryJournal(
        ctx.framework.storage.local.get<unknown>(ASSET_FACTORY_JOURNAL_KEY),
        appId,
      );
    } catch {
      // Sandboxed/disabled storage must not prevent blueprint design. The UI
      // exposes that refresh recovery is unavailable for this session.
      storageReachable = false;
    }
    const restoredDraft = createObservable<Nep17Draft>(
      storedJournal?.draft ?? launchDraft,
    );

    const recoveryState = createObservable<AssetRecoveryState>("idle");
    const recoveredDeployment = createObservable<FactoryDeploymentItem | null>(
      null,
    );
    const connectedWallet = walletAddress.get();
    const canRestoreSignature = Boolean(
      storedJournal?.signatureInfo &&
      (!connectedWallet ||
        ownerMatchesAddress(
          storedJournal.signedWalletAddress,
          connectedWallet,
        )),
    );
    const signedWalletAddress = createObservable(
      canRestoreSignature ? (storedJournal?.signedWalletAddress ?? "") : "",
    );
    const deploymentWritesEnabled = createObservable(
      ASSET_DEPLOYMENT_WRITES_ENABLED,
    );
    const journalReady = createObservable(storageReachable);
    const journalRestored = createObservable(Boolean(storedJournal));

    if (storedJournal?.plan) {
      currentPlan.set(storedJournal.plan);
      planStatus.set(
        storedJournal.plan.publishable
          ? ctx.t("packageReady")
          : ctx.t("packageBlocked"),
      );
      shortDigest.set(storedJournal.plan.digest.slice(-10));
      blockingIssueCount.set(storedJournal.plan.blockingErrors.length);
      generatedCount.set(1);
    }
    if (canRestoreSignature && storedJournal?.signatureInfo) {
      walletSignature.set(storedJournal.signatureInfo.signature);
      walletSignatureInfo.set(storedJournal.signatureInfo);
      signatureState.set(ctx.t("signed"));
    }

    let activeDigest = "";
    let coercingPlan = false;

    const persistJournal = (): void => {
      const journal = createAssetFactoryJournal(
        restoredDraft.get(),
        currentPlan.get(),
        walletSignatureInfo.get(),
        signedWalletAddress.get(),
      );
      try {
        ctx.framework.storage.local.set(ASSET_FACTORY_JOURNAL_KEY, journal);
        const readback = ctx.framework.storage.local.get<AssetFactoryJournal>(
          ASSET_FACTORY_JOURNAL_KEY,
        );
        journalReady.set(
          Boolean(
            readback?.version === ASSET_FACTORY_JOURNAL_VERSION &&
            readback.savedAt === journal.savedAt,
          ),
        );
      } catch {
        journalReady.set(false);
      }
    };

    const resetRecoveryForPlan = (): void => {
      const plan = currentPlan.get();
      const digest = plan?.digest ?? "";
      if (digest === activeDigest) return;
      activeDigest = digest;
      recoveryState.set("idle");
      recoveredDeployment.set(null);
    };

    const forceFailClosedPlan = (): void => {
      if (coercingPlan) return;
      resetRecoveryForPlan();
      const plan = currentPlan.get();
      if (
        !plan ||
        plan.execution.blockedReasonKey === "deploymentCertificationPending"
      ) return;
      coercingPlan = true;
      currentPlan.set(enforceAssetPlanSafety(plan));
      coercingPlan = false;
    };

    const stopPlanSafety = currentPlan.subscribe(forceFailClosedPlan);
    const stopFeeSafety = feeEstimateGas.subscribe(() => {
      if (feeEstimateGas.get()) feeEstimateGas.set("");
    });
    const stopSignatureSync = walletSignature.subscribe(() => {
      signedWalletAddress.set(
        walletSignature.get() ? (walletAddress.get() ?? "") : "",
      );
    });
    const stopWalletSafety = walletAddress.subscribe(() => {
      const signedBy = signedWalletAddress.get();
      if (!signedBy || ownerMatchesAddress(signedBy, walletAddress.get()))
        return;
      walletSignature.set("");
      walletSignatureInfo.set(null);
      signatureState.set(ctx.t("unsigned"));
      signedWalletAddress.set("");
      lastError.set(ctx.t("signatureWalletChanged"));
      ctx.setStatus(ctx.t("signatureWalletChanged"), "warning");
    });
    const stopPlanPersistence = currentPlan.subscribe(persistJournal);
    const stopSignaturePersistence =
      walletSignatureInfo.subscribe(persistJournal);
    const stopSignerPersistence = signedWalletAddress.subscribe(persistJournal);
    forceFailClosedPlan();

    ctx.framework.actions.register(
      "persistAssetDraft",
      async (...args: unknown[]) => {
        const draft = normalizeAssetFactoryDraft(args[0]);
        if (!draft) {
          const message = ctx.t("assetTestnetOnly");
          lastError.set(message);
          ctx.setStatus(message, "warning");
          return;
        }
        restoredDraft.set(draft);
        persistJournal();
      },
    );

    // Override the generic action registered by shared factory runtime. The
    // disabled button is the first guard; this action-level guard protects
    // programmatic dispatches and stale clients as well.
    ctx.framework.actions.register("executePlan", async () => {
      lastError.set(ctx.t("deploymentCertificationPending"));
      ctx.setStatus(ctx.t("deploymentCertificationPending"), "warning");
    });

    // A blueprint is an issuer commitment, so accepting a signature from an
    // unrelated connected wallet would be misleading even though the bytes
    // are cryptographically valid. Bind the signature to the declared owner
    // and discard it if either the wallet or plan changes while approval is
    // in flight.
    ctx.framework.actions.register("signCurrentPlan", async () => {
      if (isSigning.get()) return;
      const plan = currentPlan.get();
      if (!plan || !plan.publishable) {
        const message = ctx.t(plan ? "packageBlocked" : "noPlanToSign");
        lastError.set(message);
        ctx.setStatus(message, "warning");
        return;
      }
      const signer = walletAddress.get();
      if (!signer) {
        lastError.set(ctx.t("connectIssuerWallet"));
        ctx.setStatus(ctx.t("connectIssuerWallet"), "warning");
        return;
      }
      if (!issuerWalletMatches(plan, signer)) {
        lastError.set(ctx.t("issuerWalletMismatch"));
        ctx.setStatus(ctx.t("issuerWalletMismatch"), "error");
        return;
      }

      isSigning.set(true);
      lastError.set("");
      try {
        const message = assetFactorySignatureMessage(plan);
        const signed = await ctx.services.chain.signMessage(message);
        if (
          currentPlan.get()?.digest !== plan.digest ||
          !ownerMatchesAddress(signer, walletAddress.get())
        ) {
          walletSignature.set("");
          walletSignatureInfo.set(null);
          signatureState.set(ctx.t("unsigned"));
          lastError.set(ctx.t("signatureContextChanged"));
          ctx.setStatus(ctx.t("signatureContextChanged"), "warning");
          return;
        }
        const signature =
          typeof signed === "string"
            ? signed
            : String(signed?.data ?? "") || JSON.stringify(signed ?? {});
        if (!signature) throw new Error(ctx.t("signFailed"));
        const publicKey =
          typeof signed === "object" && signed !== null
            ? String(signed.publicKey ?? "")
            : "";
        walletSignature.set(signature);
        walletSignatureInfo.set({
          signature,
          publicKey,
          message,
          signedAt: new Date().toISOString(),
        });
        signedWalletAddress.set(signer);
        signatureState.set(ctx.t("signed"));
        ctx.setStatus(ctx.t("planSigned"), "success");
      } catch (error) {
        const message = ctx.framework.errors.messageOf(error, ctx.t("signFailed"));
        lastError.set(message);
        ctx.setStatus(message, "error");
      } finally {
        isSigning.set(false);
      }
    });

    ctx.framework.actions.register("recoverCurrentPlan", async () => {
      if (recoveryState.get() === "checking") return;
      const plan = currentPlan.get();
      if (!plan) {
        recoveryState.set("idle");
        ctx.setStatus(ctx.t("noPlanToRecover"), "info");
        return;
      }
      recoveryState.set("checking");
      recoveredDeployment.set(null);
      try {
        const result = await inspectFactoryRecord(
          plan.network,
          plan.deploymentCall.scriptHash,
          plan.kind,
          plan.packageId,
        );
        if (currentPlan.get()?.digest !== plan.digest) {
          recoveryState.set("idle");
          return;
        }
        if (result.status === "unavailable") {
          recoveryState.set("unavailable");
          ctx.setStatus(ctx.t("recovery_unavailable"), "warning");
          return;
        }
        const record = result.status === "found" ? result.record : null;
        const nextState = classifyRecoveredAsset(plan, record);
        recoveryState.set(nextState);
        if (nextState === "confirmed" || nextState === "record-only") {
          recoveredDeployment.set(record);
        }
        ctx.setStatus(
          ctx.t(`recovery_${nextState}`),
          nextState === "confirmed"
            ? "success"
            : nextState === "mismatch"
              ? "error"
              : nextState === "record-only"
                ? "warning"
                : "info",
        );
      } catch {
        if (currentPlan.get()?.digest === plan.digest) {
          recoveryState.set("unconfirmed");
          ctx.setStatus(ctx.t("recovery_unconfirmed"), "info");
        }
      }
    });

    return {
      ...base,
      state: {
        ...state,
        recoveryState,
        recoveredDeployment,
        signedWalletAddress,
        deploymentWritesEnabled,
        restoredDraft,
        journalReady,
        journalRestored,
      },
      cleanup: () => {
        stopPlanSafety();
        stopFeeSafety();
        stopSignatureSync();
        stopWalletSafety();
        stopPlanPersistence();
        stopSignaturePersistence();
        stopSignerPersistence();
        base.cleanup?.();
      },
    };
  };
}
