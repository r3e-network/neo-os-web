import { defineMiniApp } from "@shared/react/defineMiniApp";
import PlayArea from "./PlayArea";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import { useRecoveryGuardian, type RecoveryActionResult } from "./useRecoveryGuardian";

defineMiniApp({
  appId: "miniapp-recovery-guardian",
  playArea: PlayArea,
  manifest,
  messages,
  storagePrefix: "recovery-guardian:",

  setup(ctx) {
    const guardian = useRecoveryGuardian({ app: ctx.framework, t: ctx.t });

    const showOutcome = (result: RecoveryActionResult | null | undefined) => {
      if (!result) return result;
      if (result.status === "confirmed") {
        ctx.setStatus(ctx.t("recoveryTransactionConfirmed"), "success");
      } else if (result.status === "fault") {
        ctx.setStatus(ctx.t("recoveryTransactionFaulted"), "error");
      } else if (result.status === "confirmation-required") {
        ctx.setStatus(ctx.t("recoveryReviewBeforeSigning"), "info");
      } else {
        ctx.setStatus(ctx.t("recoveryTransactionPending"), "warning");
      }
      return result;
    };

    ctx.framework.actions.register("setField", async (field: unknown, value: unknown) => {
      guardian.setField(String(field ?? ""), value);
    });
    ctx.framework.actions.register("loadProfile", async () => guardian.loadProfile());
    ctx.framework.actions.register("connectWallet", async () => guardian.connectWallet());
    ctx.framework.actions.register("continueRecovery", async () => guardian.continueRecovery());
    ctx.framework.actions.register("openAAWorkspace", async () => guardian.openAAWorkspace());
    ctx.framework.actions.register("reviewSetupPackage", async () => guardian.reviewSetupPackage());
    ctx.framework.actions.register("submitSetup", async () => showOutcome(await guardian.submitSetup()));
    ctx.framework.actions.register("submitCancel", async () => showOutcome(await guardian.submitCancel()));
    ctx.framework.actions.register("submitFinalize", async () => showOutcome(await guardian.submitFinalize()));
    ctx.framework.actions.register("recoverPendingWrite", async () =>
      showOutcome(await guardian.recoverPendingWrite()));
    ctx.framework.actions.register("refreshRecoveryStorage", async () =>
      guardian.refreshRecoveryStorage());
    ctx.framework.actions.register("clearConfirmation", async () => guardian.clearConfirmation());

    return {
      state: {
        profileInput: guardian.profileInput,
        setupPackageText: guardian.setupPackageText,
        recoveryExpiryMinutes: guardian.recoveryExpiryMinutes,
        profile: guardian.profile,
        setupPreview: guardian.setupPreview,
        network: guardian.network,
        verifierHash: guardian.verifierHash,
        aaCoreHash: guardian.aaCoreHash,
        morpheusOracleHash: guardian.morpheusOracleHash,
        walletAddress: guardian.walletAddress,
        isLoading: guardian.isLoading,
        isWalletConnecting: guardian.isWalletConnecting,
        isSubmitting: guardian.isSubmitting,
        isRecovering: guardian.isRecovering,
        activeAction: guardian.activeAction,
        lastError: guardian.lastError,
        lastSuccess: guardian.lastSuccess,
        transactionNotice: guardian.transactionNotice,
        confirmationKind: guardian.confirmationKind,
        setupWriteAvailable: guardian.setupWriteAvailable,
        storageHealthy: guardian.storageHealthy,
        pendingWrite: guardian.pendingWrite,
        journeyState: guardian.journeyState,
        approvedCount: guardian.approvedCount,
        threshold: guardian.threshold,
        guardianCount: guardian.guardianCount,
        recoveryTarget: guardian.recoveryTarget,
        executableAt: guardian.executableAt,
        isConfigured: guardian.isConfigured,
        canUseIdentityWorkspace: guardian.canUseIdentityWorkspace,
        availableActions: { get: () => [], set: () => {}, subscribe: () => () => {} },
      },
      loadData: async () => {
        if (guardian.pendingWrite.get()) await guardian.recoverPendingWrite();
        if (!guardian.pendingWrite.get() && guardian.profileInput.get()) {
          await guardian.loadProfile({ quiet: true });
        }
      },
    };
  },
});
