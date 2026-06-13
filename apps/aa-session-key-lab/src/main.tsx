/**
 * AA Session Key Lab — React Entry Point
 *
 * Uses the React defineMiniApp runtime with createObservable state.
 */

import { defineMiniApp } from "@shared/react/defineMiniApp";
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
      aa: ctx.services.aa,
      chain: ctx.services.chain,
      eventBus: ctx.services.events,
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

    ctx.registerAction("generateKey", async () => {
      const result = await ctx.services.notify.guard(
        async () => {
          lab.generateSessionKey();
          return {
            publicKey: lab.form.sessionPublicKey,
            privateKey: lab.generatedPrivateKey.get(),
          };
        },
        "sessionKeyGenerated",
        "sessionKeyGenerateFailed",
      );
      return result;
    });

    ctx.registerAction(
      "checkSponsor",
      (accountSeed: unknown, dappId: unknown) => {
        lab.form.accountSeed = String(accountSeed);
        lab.form.dappId = String(dappId);
        return ctx.services.notify.guard(
          () => lab.checkSponsor(),
          "sponsorCheckComplete",
          "sponsorCheckFailed",
        );
      },
    );

    ctx.registerAction(
      "requestSponsor",
      (accountSeed: unknown, dappId: unknown, sponsorAmount: unknown) => {
        lab.form.accountSeed = String(accountSeed);
        lab.form.dappId = String(dappId);
        lab.form.sponsorAmount = String(sponsorAmount);
        return ctx.services.notify.guard(
          () => lab.requestSponsor(),
          "sponsorRequestComplete",
          "sponsorRequestFailed",
        );
      },
    );

    ctx.registerAction(
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
        await ctx.services.notify.guard(
          () => lab.configureSessionKey(),
          "sessionConfigured",
          "sessionConfigureFailed",
        );
      },
    );

    ctx.registerAction("inspectSession", async (accountSeed: unknown) => {
      lab.form.accountSeed = String(accountSeed);
      await ctx.services.notify.guard(
        () => lab.inspectSessionKey(),
        "sessionInspected",
        "sessionInspectFailed",
      );
    });

    ctx.registerAction("revokeSession", async (accountSeed: unknown) => {
      lab.form.accountSeed = String(accountSeed);
      await ctx.services.notify.guard(
        () => lab.revokeSessionKey(),
        "sessionRevoked",
        "sessionRevokeFailed",
      );
    });

    return {
      state: {
        isSubmitting: lab.isSubmitting,
        isRevoking: lab.isRevoking,
        hasOnChainSession: lab.hasOnChainSession,
        onChainSession: lab.onChainSession,
        onChainSessionView: lab.onChainSessionView,
        isCheckingSponsorship: lab.isCheckingSponsorship,
        detailItems: lab.detailItems,
        derivedAccountIdHash: lab.derivedAccountIdHash,
        normalizedTargetContract: lab.normalizedTargetContract,
        normalizedAllowedMethod: lab.normalizedAllowedMethod,
        aaCoreDisplay: lab.aaCoreDisplay,
        sessionStatusDisplay: lab.sessionStatusDisplay,
        sessionVerifierDisplay: lab.sessionVerifierDisplay,
        walletDisplay: lab.walletDisplay,
        sponsorStatusDisplay: lab.sponsorStatusDisplay,
      },
      loadData: lab.loadAll,
    };
  },
});
