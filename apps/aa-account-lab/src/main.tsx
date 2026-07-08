/**
 * AA Account Lab — React Entry Point (OS Services Pattern)
 *
 * Uses the React defineMiniApp runtime with createObservable state.
 */

import { defineMiniApp } from "@shared/react/defineMiniApp";
import PlayArea from "./PlayArea";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import { useAAAccountLab } from "./composables/useAAAccountLab";
import { getAccountLabLaunchDefaults } from "./launch";

defineMiniApp({
  appId: "miniapp-aa-account-lab",
  playArea: PlayArea,
  manifest,
  messages,

  setup(ctx) {
    const lab = useAAAccountLab({
      app: ctx.framework,
      storageService: ctx.os.storage,
      t: ctx.t,
    });
    const launchDefaults = getAccountLabLaunchDefaults(ctx.launchContext);
    if (launchDefaults.accountIdInput) {
      lab.inspectForm.accountIdInput = launchDefaults.accountIdInput;
      lab.registerForm.accountIdInput = launchDefaults.accountIdInput;
    }
    if (launchDefaults.verifierHash) {
      lab.registerForm.verifierHash = launchDefaults.verifierHash;
    }
    if (launchDefaults.verifierParamsHex) {
      lab.registerForm.verifierParamsHex = launchDefaults.verifierParamsHex;
    }
    if (launchDefaults.hookHash) {
      lab.registerForm.hookHash = launchDefaults.hookHash;
    }
    if (launchDefaults.backupOwner) {
      lab.registerForm.backupOwner = launchDefaults.backupOwner;
    }
    if (launchDefaults.escapeTimelock) {
      lab.registerForm.escapeTimelock = launchDefaults.escapeTimelock;
    }

    ctx.framework.actions.register("inspect", async (accountIdInput: unknown) => {
      lab.inspectForm.accountIdInput = String(accountIdInput);
      await ctx.framework.notify.guard(() => lab.inspectAccount(), {
        successKey: "inspectSuccess",
        errorKey: "invalidAccountId",
      });
    });

    ctx.framework.actions.register(
      "register",
      async (
        accountIdInput: unknown,
        verifierHash: unknown,
        verifierParamsHex: unknown,
        hookHash: unknown,
        backupOwner: unknown,
        escapeTimelock: unknown,
      ) => {
        lab.registerForm.accountIdInput = String(accountIdInput);
        lab.registerForm.verifierHash = String(verifierHash);
        lab.registerForm.verifierParamsHex = String(verifierParamsHex);
        lab.registerForm.hookHash = String(hookHash);
        lab.registerForm.backupOwner = String(backupOwner);
        lab.registerForm.escapeTimelock = String(escapeTimelock);
        await ctx.framework.notify.guard(() => lab.submitRegister(), {
          successKey: "registerSuccess",
          errorKey: "invalidAccountId",
        });
      },
    );

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
        currentEscapeTimelock: lab.currentEscapeTimelock,
        currentEscapeActive: lab.currentEscapeActive,
        hasInspected: lab.hasInspected,
        aaCoreDisplay: lab.aaCoreDisplay,
        defaultVerifierDisplay: lab.defaultVerifierDisplay,
        networkDisplay: lab.networkDisplay,
        connectedWalletDisplay: lab.connectedWalletDisplay,
        isInspecting: lab.isInspecting,
        isSubmitting: lab.isSubmitting,
      },
      loadData: lab.loadAll,
    };
  },
});
