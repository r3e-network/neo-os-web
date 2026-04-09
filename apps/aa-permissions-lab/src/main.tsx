/**
 * AA Permissions Lab — React Entry Point (OS Services Pattern)
 *
 * Uses the React defineMiniApp runtime with createObservable state.
 */

import { defineMiniApp } from "@shared/react/defineMiniApp";
import PlayArea from "./PlayArea";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import { useAAPermissionsLab } from "./composables/useAAPermissionsLab";

defineMiniApp({
  appId: "miniapp-aa-permissions-lab",
  playArea: PlayArea,
  manifest,
  messages,

  setup(ctx) {
    const lab = useAAPermissionsLab({
      chain: ctx.services.chain,
      storageService: ctx.os.storage,
      t: ctx.t,
    });

    ctx.registerAction("refresh", async (accountIdHash: unknown) => {
      lab.form.accountIdHash = String(accountIdHash);
      await ctx.services.notify.guard(
        () => lab.refreshState(),
        "inspectComplete",
        "inspectFailed",
      );
    });

    ctx.registerAction(
      "submitVerifier",
      async (
        accountIdHash: unknown,
        verifierHash: unknown,
        verifierParamsHex: unknown,
      ) => {
        lab.form.accountIdHash = String(accountIdHash);
        lab.form.verifierHash = String(verifierHash);
        lab.form.verifierParamsHex = String(verifierParamsHex);
        await ctx.services.notify.guard(
          () => lab.submitVerifier(),
          "successVerifier",
          "updateVerifierFailed",
        );
      },
    );

    ctx.registerAction(
      "submitHook",
      async (accountIdHash: unknown, hookHash: unknown) => {
        lab.form.accountIdHash = String(accountIdHash);
        lab.form.hookHash = String(hookHash);
        await ctx.services.notify.guard(
          () => lab.submitHook(),
          "successHook",
          "updateHookFailed",
        );
      },
    );

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
    };
  },
});
