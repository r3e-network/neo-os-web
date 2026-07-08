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
import { getPermissionsLaunchDefaults } from "./launch";

defineMiniApp({
  appId: "miniapp-aa-permissions-lab",
  playArea: PlayArea,
  manifest,
  messages,

  setup(ctx) {
    const lab = useAAPermissionsLab({
      app: ctx.framework,
      storageService: ctx.os.storage,
      t: ctx.t,
    });
    const launchDefaults = getPermissionsLaunchDefaults(ctx.launchContext);
    if (launchDefaults.accountIdHash) {
      lab.form.accountIdHash = launchDefaults.accountIdHash;
    }
    if (launchDefaults.verifierHash) {
      lab.form.verifierHash = launchDefaults.verifierHash;
    }
    if (launchDefaults.verifierParamsHex) {
      lab.form.verifierParamsHex = launchDefaults.verifierParamsHex;
    }
    if (launchDefaults.hookHash) {
      lab.form.hookHash = launchDefaults.hookHash;
    }

    ctx.framework.actions.register("refresh", async (accountIdHash: unknown) => {
      lab.form.accountIdHash = String(accountIdHash);
      await ctx.framework.notify.guard(() => lab.refreshState(), {
        successKey: "inspectComplete",
        errorKey: "inspectFailed",
      });
    });

    ctx.framework.actions.register(
      "submitVerifier",
      async (
        accountIdHash: unknown,
        verifierHash: unknown,
        verifierParamsHex: unknown,
      ) => {
        lab.form.accountIdHash = String(accountIdHash);
        lab.form.verifierHash = String(verifierHash);
        lab.form.verifierParamsHex = String(verifierParamsHex);
        await ctx.framework.notify.guard(() => lab.submitVerifier(), {
          successKey: "successVerifier",
          errorKey: "updateVerifierFailed",
        });
      },
    );

    ctx.framework.actions.register(
      "submitHook",
      async (accountIdHash: unknown, hookHash: unknown) => {
        lab.form.accountIdHash = String(accountIdHash);
        lab.form.hookHash = String(hookHash);
        await ctx.framework.notify.guard(() => lab.submitHook(), {
          successKey: "successHook",
          errorKey: "updateHookFailed",
        });
      },
    );

    ctx.framework.actions.register("confirmVerifier", async (accountIdHash: unknown) => {
      lab.form.accountIdHash = String(accountIdHash);
      await ctx.framework.notify.guard(() => lab.confirmVerifier(), {
        successKey: "confirmVerifierSuccess",
        errorKey: "updateVerifierFailed",
      });
    });

    ctx.framework.actions.register("cancelVerifier", async (accountIdHash: unknown) => {
      lab.form.accountIdHash = String(accountIdHash);
      await ctx.framework.notify.guard(() => lab.cancelVerifier(), {
        successKey: "cancelVerifierSuccess",
        errorKey: "updateVerifierFailed",
      });
    });

    ctx.framework.actions.register("confirmHook", async (accountIdHash: unknown) => {
      lab.form.accountIdHash = String(accountIdHash);
      await ctx.framework.notify.guard(() => lab.confirmHook(), {
        successKey: "confirmHookSuccess",
        errorKey: "updateHookFailed",
      });
    });

    ctx.framework.actions.register("cancelHook", async (accountIdHash: unknown) => {
      lab.form.accountIdHash = String(accountIdHash);
      await ctx.framework.notify.guard(() => lab.cancelHook(), {
        successKey: "cancelHookSuccess",
        errorKey: "updateHookFailed",
      });
    });

    ctx.framework.actions.register("connect", () =>
      ctx.framework.notify.guard(() => ctx.framework.wallet.ensure(), {
        successKey: "walletConnected",
        errorKey: "connectFailed",
      }),
    );

    return {
      state: {
        currentVerifier: lab.currentVerifier,
        currentHook: lab.currentHook,
        currentBackupOwner: lab.currentBackupOwner,
        hasInspected: lab.hasInspected,
        hasPendingVerifier: lab.hasPendingVerifier,
        hasPendingHook: lab.hasPendingHook,
        pendingVerifierUnlockAt: lab.pendingVerifierUnlockAt,
        pendingHookUnlockAt: lab.pendingHookUnlockAt,
        connectedWalletDisplay: lab.connectedWalletDisplay,
        isRefreshing: lab.isRefreshing,
        isVerifierBusy: lab.isVerifierBusy,
        isHookBusy: lab.isHookBusy,
      },
      loadData: lab.loadAll,
    };
  },
});
