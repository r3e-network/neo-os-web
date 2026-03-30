/**
 * AA Account Lab — Entry Point (OS Services Pattern)
 *
 * This miniapp primarily uses the AA platform service (ctx.services.aa)
 * for account abstraction operations. The chain service is retained for
 * aaCore contract reads/writes since there is no OS-level AA proxy.
 *
 * StorageProxy (ctx.os.storage) is used for caching inspected account
 * state so results persist across sessions.
 *
 * Architecture:
 *   main.ts -> defineMiniApp({ playArea, manifest, setup })
 *   setup() -> useAAAccountLab({ chain, storageService, t })
 *
 * The composable calls:
 *   ctx.services.chain.invokeRead(aaCore, method, params)  — read AA state
 *   ctx.services.chain.invokeWrite(aaCore, method, params) — write AA state
 *   ctx.os.storage.set(`account:${hash}`, data)            — cache results
 *
 * Everything else (manifest, PlayArea, i18n, actions) stays the same.
 */

import { defineMiniApp } from "@shared/utils/defineMiniApp";
import PlayArea from "./PlayArea.vue";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import { useAAAccountLab } from "./composables/useAAAccountLab";

defineMiniApp({
  appId: "miniapp-aa-account-lab",
  playArea: PlayArea,
  manifest,
  messages,

  /**
   * Setup function — wires AA platform service + OS storage to reactive state.
   *
   * Called once when the miniapp mounts. Uses ctx.services.chain for AA
   * contract reads/writes and ctx.os.storage for caching inspected state.
   */
  setup(ctx) {
    const lab = useAAAccountLab({
      chain: ctx.services.chain,
      storageService: ctx.os.storage,
      t: ctx.t,
    });

    // Register actions for PlayArea to invoke
    ctx.registerAction("inspect", async (accountIdInput: string) => {
      lab.inspectForm.accountIdInput = accountIdInput;
      await ctx.services.notify.guard(
        () => lab.inspectAccount(),
        "inspectSuccess",
        "invalidAccountId",
      );
    });

    ctx.registerAction(
      "register",
      async (
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
