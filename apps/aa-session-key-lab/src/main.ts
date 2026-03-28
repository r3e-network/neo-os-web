/**
 * AA Session Key Lab — Entry Point (New Pattern)
 *
 * Uses defineMiniApp() to wire PlayArea, manifest, messages, and domain logic.
 */

import { defineMiniApp } from "@shared/utils/defineMiniApp";
import { PlatformServices } from "@shared/services";
import PlayArea from "./PlayArea.vue";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import { useAASessionKeyLab } from "./composables/useAASessionKeyLab";

defineMiniApp({
  appId: "miniapp-aa-session-key-lab",
  playArea: PlayArea,
  manifest,
  messages,

  setup(ctx) {
    const platformServices = PlatformServices.create("miniapp-aa-session-key-lab", {
      t: ctx.t as (key: string) => string,
    });

    const lab = useAASessionKeyLab({
      aa: platformServices.aa,
      chain: platformServices.chain,
      eventBus: platformServices.events,
      t: ctx.t,
    });

    ctx.registerAction("generateKey", async () => {
      const result = await platformServices.notify.guard(
        async () => { lab.generateSessionKey(); return { publicKey: lab.form.sessionPublicKey }; },
        "sessionKeyGenerated", "sessionKeyGenerateFailed",
      );
      return result;
    });

    ctx.registerAction("checkSponsor", () =>
      platformServices.notify.guard(() => lab.checkSponsor(), "sponsorCheckComplete", "sponsorCheckFailed"),
    );

    ctx.registerAction("requestSponsor", () =>
      platformServices.notify.guard(() => lab.requestSponsor(), "sponsorRequestComplete", "sponsorRequestFailed"),
    );

    ctx.registerAction("configureSessionKey", async (accountSeed: string, sessionPublicKey: string, targetContract: string, allowedMethod: string, expiresAt: string) => {
      lab.form.accountSeed = accountSeed;
      lab.form.sessionPublicKey = sessionPublicKey;
      lab.form.targetContract = targetContract;
      lab.form.allowedMethod = allowedMethod;
      lab.form.expiresAt = expiresAt;
      await platformServices.notify.guard(() => lab.configureSessionKey(), "sessionConfigured", "sessionConfigureFailed");
    });

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
      cleanup: () => platformServices.destroy(),
    };
  },
});
