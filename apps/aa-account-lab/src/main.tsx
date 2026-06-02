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
      chain: ctx.services.chain,
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

    ctx.registerAction("inspect", async (accountIdInput: unknown) => {
      lab.inspectForm.accountIdInput = String(accountIdInput);
      await ctx.services.notify.guard(
        () => lab.inspectAccount(),
        "inspectSuccess",
        "invalidAccountId",
      );
    });

    ctx.registerAction(
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
        await ctx.services.notify.guard(
          () => lab.submitRegister(),
          "registerSuccess",
          "invalidAccountId",
        );
      },
    );

    ctx.registerAction("connect", () =>
      ctx.services.notify.guard(
        () => ctx.services.chain.ensureWallet(),
        "walletConnected",
        "connectFailed",
      ),
    );

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
    };
  },
});
