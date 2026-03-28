/**
 * Oracle NeoDID Console — Entry Point (New Pattern)
 *
 * Uses defineMiniApp() to wire the NeoDID console with manifest-driven
 * platform sections and a composable for domain logic.
 */

import { defineMiniApp } from "@shared/utils/defineMiniApp";
import { PlatformServices } from "@shared/services";
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
    const platformServices = PlatformServices.create("miniapp-oracle-neodid-console", {
      t: ctx.t as (key: string) => string,
    });

    const neodid = useNeodidConsole({
      oracle: platformServices.oracle,
      t: ctx.t,
    });

    ctx.registerAction("resolveDid", async () => {
      try {
        await neodid.resolveDid();
        ctx.setStatus(ctx.t("resultLoaded"), "success");
      } catch (e) {
        ctx.setStatus(e instanceof Error ? e.message : ctx.t("resolveFailed"), "error");
      }
    });

    ctx.registerAction("loadProviders", async () => {
      try {
        await neodid.loadProviders();
        ctx.setStatus(ctx.t("resultLoaded"), "success");
      } catch (e) {
        ctx.setStatus(e instanceof Error ? e.message : ctx.t("loadProvidersFailed"), "error");
      }
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
      cleanup: () => {
        platformServices.destroy();
      },
    };
  },
});
