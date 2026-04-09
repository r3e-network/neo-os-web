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

    ctx.registerAction("generateKey", async () => {
      const result = await ctx.services.notify.guard(
        async () => {
          lab.generateSessionKey();
          return { publicKey: lab.form.sessionPublicKey };
        },
        "sessionKeyGenerated",
        "sessionKeyGenerateFailed",
      );
      return result;
    });

    ctx.registerAction("checkSponsor", () =>
      ctx.services.notify.guard(
        () => lab.checkSponsor(),
        "sponsorCheckComplete",
        "sponsorCheckFailed",
      ),
    );

    ctx.registerAction("requestSponsor", () =>
      ctx.services.notify.guard(
        () => lab.requestSponsor(),
        "sponsorRequestComplete",
        "sponsorRequestFailed",
      ),
    );

    ctx.registerAction(
      "configureSessionKey",
      async (
        accountSeed: unknown,
        sessionPublicKey: unknown,
        targetContract: unknown,
        allowedMethod: unknown,
        expiresAt: unknown,
      ) => {
        lab.form.accountSeed = String(accountSeed);
        lab.form.sessionPublicKey = String(sessionPublicKey);
        lab.form.targetContract = String(targetContract);
        lab.form.allowedMethod = String(allowedMethod);
        lab.form.expiresAt = String(expiresAt);
        await ctx.services.notify.guard(
          () => lab.configureSessionKey(),
          "sessionConfigured",
          "sessionConfigureFailed",
        );
      },
    );

    return {
      state: {
        isSubmitting: lab.isSubmitting,
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
