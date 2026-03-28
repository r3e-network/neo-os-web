/**
 * Oracle NeoDID Console — Entry Point (New Pattern)
 *
 * Uses defineMiniApp() to wire the NeoDID console with manifest-driven
 * platform sections and a composable for domain logic.
 */

import { defineMiniApp } from "@shared/utils/defineMiniApp";
import PlayArea from "./PlayArea.vue";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import { useNeodidConsole } from "./composables/useNeodidConsole";

defineMiniApp({
  appId: "miniapp-oracle-neodid-console",
  playArea: PlayArea,
  manifest,
  messages,

  setup(ctx) {
    const platformServices = ctx.services;

    const { notify } = platformServices;

    const neodid = useNeodidConsole({
      oracle: platformServices.oracle,
      t: ctx.t,
    });

    ctx.registerAction("resolveDid", async () => {
      await notify.guard(() => neodid.resolveDid(), "resultLoaded");
    });

    ctx.registerAction("loadProviders", async () => {
      await notify.guard(() => neodid.loadProviders(), "resultLoaded");
    });

    ctx.registerAction("applyExample", (kind: string) => {
      neodid.applyExample(kind as "service" | "vault" | "aa");
    });

    ctx.registerAction("updateDid", (val: string) => {
      neodid.did.value = val;
    });

    ctx.registerAction("updateFormat", (val: string) => {
      neodid.format.value = val;
    });

    return {
      state: {
        did: neodid.did,
        format: neodid.format,
        renderedPayload: neodid.renderedPayload,
        providerCount: neodid.providerCount,
        formatDisplay: neodid.formatDisplay,
        networkDisplay: neodid.networkDisplay,
        publicApiUrl: neodid.publicApiUrl,
        neodidContract: neodid.neodidContract,
        neodidDomain: neodid.neodidDomain,
        isRequesting: neodid.isRequesting,
      },
      loadData: neodid.loadAll,
    };
  },
});
