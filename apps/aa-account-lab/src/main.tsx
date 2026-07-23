/**
 * AA Account Lab — React Entry Point (OS Services Pattern)
 *
 * Uses the React defineMiniApp runtime with createObservable state.
 */

import { defineMiniApp } from "@shared/react/defineMiniApp";
import { createObservable } from "@shared/react/context";
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
      storageService: ctx.framework.storage.remote,
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
        try {
          const result = await lab.submitRegister();
          if (result.status === "confirmed") {
            ctx.setStatus(ctx.t("registrationConfirmed"), "success");
          } else if (result.status === "fault") {
            ctx.setStatus(ctx.t("registrationFaulted"), "error");
          } else {
            ctx.setStatus(ctx.t("registrationPending"), "warning");
          }
          return result;
        } catch (error) {
          const message = ctx.framework.errors.messageOf(error, ctx.t("registrationFailed"));
          ctx.setStatus(message, "error");
          throw error;
        }
      },
    );

    ctx.framework.actions.register("recoverRegistration", async () => {
      const result = await lab.recoverPendingRegistration();
      if (!result) return result;
      ctx.setStatus(
        ctx.t(result.status === "confirmed"
          ? "registrationConfirmed"
          : result.status === "fault"
            ? "registrationFaulted"
            : "registrationPending"),
        result.status === "confirmed" ? "success" : result.status === "fault" ? "error" : "warning",
      );
      return result;
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
        currentEscapeTimelock: lab.currentEscapeTimelock,
        currentEscapeActive: lab.currentEscapeActive,
        inspectedAccountId: lab.inspectedAccountId,
        hasInspected: lab.hasInspected,
        aaCoreDisplay: lab.aaCoreDisplay,
        defaultVerifierDisplay: lab.defaultVerifierDisplay,
        networkDisplay: lab.networkDisplay,
        connectedWalletDisplay: lab.connectedWalletDisplay,
        isInspecting: lab.isInspecting,
        isSubmitting: lab.isSubmitting,
        isRecovering: lab.isRecovering,
        pendingRegistration: lab.pendingRegistration,
        pendingStorageHealthy: lab.pendingStorageHealthy,
        lastStatus: lab.lastStatus,
        lastError: lab.lastError,
        lastSuccess: lab.lastSuccess,
        launchAccountIdInput: createObservable(launchDefaults.accountIdInput),
        launchVerifierHash: createObservable(launchDefaults.verifierHash),
        launchVerifierParamsHex: createObservable(launchDefaults.verifierParamsHex),
        launchHookHash: createObservable(launchDefaults.hookHash),
        launchBackupOwner: createObservable(launchDefaults.backupOwner),
        launchEscapeTimelock: createObservable(launchDefaults.escapeTimelock),
      },
      loadData: lab.loadAll,
    };
  },
});
