/**
 * AA Session Key Lab — React Entry Point
 *
 * Uses the React defineMiniApp runtime with createObservable state.
 */

import { defineMiniApp } from "@shared/react/defineMiniApp";
import { createObservable } from "@shared/react/context";
import PlayArea from "./PlayArea";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import { useAASessionKeyLab } from "./composables/useAASessionKeyLab";
import { getSessionKeyLaunchDefaults } from "./launch";

defineMiniApp({
  appId: "miniapp-aa-session-key-lab",
  playArea: PlayArea,
  manifest,
  messages,

  setup(ctx) {
    const lab = useAASessionKeyLab({
      app: ctx.framework,
      t: ctx.t,
    });
    const launchDefaults = getSessionKeyLaunchDefaults(ctx.launchContext);
    lab.form.accountSeed = launchDefaults.accountSeed;
    lab.form.sessionPublicKey = launchDefaults.sessionPublicKey;
    lab.form.targetContract = launchDefaults.targetContract;
    lab.form.allowedMethod = launchDefaults.allowedMethod;
    lab.form.expiresAt = launchDefaults.expiresAt;
    lab.form.dappId = launchDefaults.dappId;
    lab.form.sponsorAmount = launchDefaults.sponsorAmount;

    ctx.framework.actions.register("generateKey", async () => {
      const result = await ctx.framework.notify.guard(
        async () => {
          lab.generateSessionKey();
          return {
            publicKey: lab.form.sessionPublicKey,
            privateKey: lab.generatedPrivateKey.get(),
          };
        },
        { successKey: "sessionKeyGenerated", errorKey: "sessionKeyGenerateFailed" },
      );
      return result;
    });

    ctx.framework.actions.register("copyPrivateKey", async () => {
      const privateKey = lab.generatedPrivateKey.get();
      if (!privateKey) throw new Error(ctx.t("sessionKeyMissing"));
      await ctx.framework.clipboard.copy(privateKey, {
        successKey: "copiedPrivateKey",
        errorKey: "copyPrivateKeyFailed",
      });
    });

    ctx.framework.actions.register(
      "checkSponsor",
      (accountSeed: unknown, dappId: unknown) => {
        lab.form.accountSeed = String(accountSeed);
        lab.form.dappId = String(dappId);
        return ctx.framework.notify.guard(() => lab.checkSponsor(), {
          successKey: "sponsorCheckComplete",
          errorKey: "sponsorCheckFailed",
        });
      },
    );

    ctx.framework.actions.register(
      "requestSponsor",
      (accountSeed: unknown, dappId: unknown, sponsorAmount: unknown) => {
        lab.form.accountSeed = String(accountSeed);
        lab.form.dappId = String(dappId);
        lab.form.sponsorAmount = String(sponsorAmount);
        return ctx.framework.notify.guard(() => lab.requestSponsor(), {
          successKey: "sponsorRequestComplete",
          errorKey: "sponsorRequestFailed",
        });
      },
    );

    ctx.framework.actions.register(
      "configureSessionKey",
      async (
        accountSeed: unknown,
        sessionPublicKey: unknown,
        targetContract: unknown,
        allowedMethod: unknown,
        expiresAt: unknown,
        spendingLimit: unknown,
        description: unknown,
      ) => {
        lab.form.accountSeed = String(accountSeed);
        lab.form.sessionPublicKey = String(sessionPublicKey);
        lab.form.targetContract = String(targetContract);
        lab.form.allowedMethod = String(allowedMethod);
        lab.form.expiresAt = String(expiresAt);
        if (spendingLimit !== undefined) {
          lab.form.spendingLimit = String(spendingLimit);
        }
        if (description !== undefined) {
          lab.form.description = String(description);
        }
        await ctx.framework.notify.guard(() => lab.configureSessionKey(), {
          successKey: "sessionConfigured",
          errorKey: "sessionConfigureFailed",
        });
      },
    );

    ctx.framework.actions.register("inspectSession", async (accountSeed: unknown) => {
      lab.form.accountSeed = String(accountSeed);
      await ctx.framework.notify.guard(() => lab.inspectSessionKey(), {
        errorKey: "sessionInspectFailed",
      });
    });

    ctx.framework.actions.register("connectOwner", async (accountSeed: unknown) => {
      lab.form.accountSeed = String(accountSeed);
      await ctx.framework.notify.guard(() => lab.connectOwnerWallet(), {
        errorKey: "sessionOwnerConnectFailed",
      });
    });

    ctx.framework.actions.register("recoverPending", async () => {
      await ctx.framework.notify.guard(() => lab.recoverPendingWrite(), {
        errorKey: "sessionRecoveryFailed",
      });
    });

    ctx.framework.actions.register("revokeSession", async (accountSeed: unknown) => {
      lab.form.accountSeed = String(accountSeed);
      await ctx.framework.notify.guard(() => lab.revokeSessionKey(), {
        successKey: "sessionRevoked",
        errorKey: "sessionRevokeFailed",
      });
    });

    return {
      state: {
        isSubmitting: lab.isSubmitting,
        isRevoking: lab.isRevoking,
        isInspecting: lab.isInspecting,
        isRecovering: lab.isRecovering,
        hasOnChainSession: lab.hasOnChainSession,
        onChainSession: lab.onChainSession,
        onChainSessionView: lab.onChainSessionView,
        generatedPublicKey: lab.generatedPublicKey,
        generatedPrivateKey: lab.generatedPrivateKey,
        isCheckingSponsorship: lab.isCheckingSponsorship,
        detailItems: lab.detailItems,
        derivedAccountIdHash: lab.derivedAccountIdHash,
        inspectedAccountIdHash: lab.inspectedAccountIdHash,
        accountOwner: lab.accountOwner,
        accountVerifier: lab.accountVerifier,
        accountReadStatus: lab.accountReadStatus,
        sessionReadStatus: lab.sessionReadStatus,
        verifierBound: lab.verifierBound,
        ownerAuthorityStatus: lab.ownerAuthorityStatus,
        allowanceSupported: lab.allowanceSupported,
        activeNetwork: lab.activeNetwork,
        walletNetwork: lab.walletNetwork,
        networkDisplay: lab.networkDisplay,
        accountStatusDisplay: lab.accountStatusDisplay,
        writePhase: lab.writePhase,
        pendingWrite: lab.pendingWrite,
        canConfigure: lab.canConfigure,
        canRevoke: lab.canRevoke,
        lastError: lab.lastError,
        lastTransactionId: lab.lastTransactionId,
        normalizedTargetContract: lab.normalizedTargetContract,
        normalizedAllowedMethod: lab.normalizedAllowedMethod,
        aaCoreDisplay: lab.aaCoreDisplay,
        sessionStatusDisplay: lab.sessionStatusDisplay,
        sessionVerifierDisplay: lab.sessionVerifierDisplay,
        walletDisplay: lab.walletDisplay,
        sponsorStatusDisplay: lab.sponsorStatusDisplay,
        launchAccountId: createObservable(launchDefaults.accountSeed),
      },
      loadData: lab.loadAll,
    };
  },
});
