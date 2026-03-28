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

    ctx.registerAction("generateKey", () => {
      try {
        lab.generateSessionKey();
        ctx.setStatus(ctx.t("sessionKeyGenerated"), "success");
        return { publicKey: lab.form.sessionPublicKey };
      } catch (e) {
        ctx.setStatus(e instanceof Error ? e.message : ctx.t("sessionKeyGenerateFailed"), "error");
      }
    });

    ctx.registerAction("checkSponsor", async () => {
      try {
        await lab.checkSponsor();
        ctx.setStatus(ctx.t("sponsorCheckComplete"), "success");
      } catch (e) {
        ctx.setStatus(e instanceof Error ? e.message : ctx.t("sponsorCheckFailed"), "error");
      }
    });

    ctx.registerAction("requestSponsor", async () => {
      try {
        await lab.requestSponsor();
        ctx.setStatus(ctx.t("sponsorRequestComplete"), "success");
      } catch (e) {
        ctx.setStatus(e instanceof Error ? e.message : ctx.t("sponsorRequestFailed"), "error");
      }
    });

    ctx.registerAction("configureSessionKey", async (accountSeed: string, sessionPublicKey: string, targetContract: string, allowedMethod: string, expiresAt: string) => {
      try {
        lab.form.accountSeed = accountSeed;
        lab.form.sessionPublicKey = sessionPublicKey;
        lab.form.targetContract = targetContract;
        lab.form.allowedMethod = allowedMethod;
        lab.form.expiresAt = expiresAt;
        await lab.configureSessionKey();
        ctx.setStatus(ctx.t("sessionConfigured"), "success");
      } catch (e) {
        ctx.setStatus(e instanceof Error ? e.message : ctx.t("sessionConfigureFailed"), "error");
      }
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
