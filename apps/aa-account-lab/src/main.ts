/**
 * AA Account Lab — Entry Point (New Pattern)
 *
 * Uses defineMiniApp() to wire PlayArea, manifest, messages, and domain logic.
 */

import { defineMiniApp } from "@shared/utils/defineMiniApp";
import { PlatformServices } from "@shared/services";
import PlayArea from "./PlayArea.vue";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import { useAAAccountLab } from "./composables/useAAAccountLab";

defineMiniApp({
  appId: "miniapp-aa-account-lab",
  playArea: PlayArea,
  manifest,
  messages,

  setup(ctx) {
    const platformServices = PlatformServices.create("miniapp-aa-account-lab", {
      t: ctx.t as (key: string) => string,
    });

    const lab = useAAAccountLab({
      chain: platformServices.chain,
      eventBus: platformServices.events,
      t: ctx.t,
    });

    // Register actions for PlayArea to invoke
    ctx.registerAction("inspect", async (accountIdInput: string) => {
      lab.inspectForm.accountIdInput = accountIdInput;
      try {
        await lab.inspectAccount();
        ctx.setStatus(ctx.t("inspectSuccess"), "success");
      } catch (e) {
        ctx.setStatus(e instanceof Error ? e.message : ctx.t("invalidAccountId"), "error");
      }
    });

    ctx.registerAction("register", async (
      accountIdInput: string,
      verifierHash: string,
      verifierParamsHex: string,
      hookHash: string,
      backupOwner: string,
      escapeTimelock: string,
    ) => {
      lab.registerForm.accountIdInput = accountIdInput;
      lab.registerForm.verifierHash = verifierHash;
      lab.registerForm.verifierParamsHex = verifierParamsHex;
      lab.registerForm.hookHash = hookHash;
      lab.registerForm.backupOwner = backupOwner;
      lab.registerForm.escapeTimelock = escapeTimelock;
      try {
        await lab.submitRegister();
        ctx.setStatus(ctx.t("registerSuccess"), "success");
      } catch (e) {
        ctx.setStatus(e instanceof Error ? e.message : ctx.t("invalidAccountId"), "error");
      }
    });

    ctx.registerAction("connect", async () => {
      try {
        await platformServices.chain.ensureWallet();
        ctx.setStatus("Wallet connected", "success");
      } catch (e) {
        ctx.setStatus(e instanceof Error ? e.message : "Connect failed", "error");
      }
    });

    return {
      state: {
        currentVerifier: lab.currentVerifier,
        currentHook: lab.currentHook,
        currentBackupOwner: lab.currentBackupOwner,
        aaCoreDisplay: lab.aaCoreDisplay,
        defaultVerifierDisplay: lab.defaultVerifierDisplay,
        networkDisplay: lab.networkDisplay,
        isInspecting: lab.isInspecting,
        isSubmitting: lab.isSubmitting,
      },
      loadData: lab.loadAll,
      cleanup: () => platformServices.destroy(),
    };
  },
});
