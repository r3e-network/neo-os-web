/**
 * AA Permissions Lab — Entry Point (OS Services Pattern)
 *
 * This miniapp primarily uses the AA platform service for account
 * abstraction operations. The chain service is retained for aaCore
 * contract reads/writes since there is no OS-level AA proxy.
 *
 * StorageProxy (ctx.os.storage) is used for caching inspected
 * permissions state so results persist across sessions.
 *
 * Architecture:
 *   main.ts -> defineMiniApp({ playArea, manifest, setup })
 *   setup() -> useAAPermissionsLab({ chain, storageService, t })
 *
 * The composable calls:
 *   ctx.services.chain.invokeRead(aaCore, method, params)   — read AA state
 *   ctx.services.chain.invokeWrite(aaCore, method, params)  — write AA state
 *   ctx.os.storage.set(`permissions:${hash}`, data)         — cache results
 *
 * Everything else (manifest, PlayArea, i18n, actions) stays the same.
 */

import { defineMiniApp } from "@shared/utils/defineMiniApp";
import PlayArea from "./PlayArea.vue";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import { useAAPermissionsLab } from "./composables/useAAPermissionsLab";

defineMiniApp({
  appId: "miniapp-aa-permissions-lab",
  playArea: PlayArea,
  manifest,
  messages,

  /**
   * Setup function — wires AA platform service + OS storage to reactive state.
   *
   * Called once when the miniapp mounts. Uses ctx.services.chain for AA
   * contract reads/writes and ctx.os.storage for caching permissions state.
   */
  setup(ctx) {
    const lab = useAAPermissionsLab({
      chain: ctx.services.chain,
      storageService: ctx.os.storage,
      t: ctx.t,
    });

    ctx.registerAction("refresh", async (accountIdHash: string) => {
      lab.form.accountIdHash = accountIdHash;
      await ctx.services.notify.guard(
        () => lab.refreshState(),
        "inspectComplete",
        "inspectFailed",
      );
    });

    ctx.registerAction(
      "submitVerifier",
      async (
        accountIdHash: string,
        verifierHash: string,
        verifierParamsHex: string,
      ) => {
        lab.form.accountIdHash = accountIdHash;
        lab.form.verifierHash = verifierHash;
        lab.form.verifierParamsHex = verifierParamsHex;
        await ctx.services.notify.guard(
          () => lab.submitVerifier(),
          "successVerifier",
          "updateVerifierFailed",
        );
      },
    );

    ctx.registerAction(
      "submitHook",
      async (accountIdHash: string, hookHash: string) => {
        lab.form.accountIdHash = accountIdHash;
        lab.form.hookHash = hookHash;
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
