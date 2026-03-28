/**
 * AA Permissions Lab — Entry Point (New Pattern)
 */

import { defineMiniApp } from "@shared/utils/defineMiniApp";
import { PlatformServices } from "@shared/services";
import PlayArea from "./PlayArea.vue";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import { useAAPermissionsLab } from "./composables/useAAPermissionsLab";

defineMiniApp({
  appId: "miniapp-aa-permissions-lab",
  playArea: PlayArea,
  manifest,
  messages,

  setup(ctx) {
    const platformServices = PlatformServices.create("miniapp-aa-permissions-lab", {
      t: ctx.t as (key: string) => string,
    });

    const lab = useAAPermissionsLab({
      chain: platformServices.chain,
      eventBus: platformServices.events,
      t: ctx.t,
    });

    ctx.registerAction("refresh", async (accountIdHash: string) => {
      lab.form.accountIdHash = accountIdHash;
      try {
        await lab.refreshState();
        ctx.setStatus(ctx.t("inspect") + " complete", "success");
      } catch (e) {
        ctx.setStatus(e instanceof Error ? e.message : ctx.t("inspectFailed"), "error");
      }
    });

    ctx.registerAction("submitVerifier", async (accountIdHash: string, verifierHash: string, verifierParamsHex: string) => {
      lab.form.accountIdHash = accountIdHash;
      lab.form.verifierHash = verifierHash;
      lab.form.verifierParamsHex = verifierParamsHex;
      try {
        await lab.submitVerifier();
        ctx.setStatus(ctx.t("successVerifier"), "success");
      } catch (e) {
        ctx.setStatus(e instanceof Error ? e.message : ctx.t("updateVerifierFailed"), "error");
      }
    });

    ctx.registerAction("submitHook", async (accountIdHash: string, hookHash: string) => {
      lab.form.accountIdHash = accountIdHash;
      lab.form.hookHash = hookHash;
      try {
        await lab.submitHook();
        ctx.setStatus(ctx.t("successHook"), "success");
      } catch (e) {
        ctx.setStatus(e instanceof Error ? e.message : ctx.t("updateHookFailed"), "error");
      }
    });

    return {
      state: {
        currentVerifier: lab.currentVerifier,
        currentHook: lab.currentHook,
        currentBackupOwner: lab.currentBackupOwner,
        isRefreshing: lab.isRefreshing,
        isVerifierBusy: lab.isVerifierBusy,
        isHookBusy: lab.isHookBusy,
      },
      loadData: lab.loadAll,
      cleanup: () => platformServices.destroy(),
    };
  },
});
