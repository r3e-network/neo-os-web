/**
 * Oracle NeoDID Console — React Entry Point
 *
 * Uses the React defineMiniApp runtime with createObservable state.
 */

import { defineMiniApp } from "@shared/react/defineMiniApp";
import PlayArea from "./PlayArea";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import { useNeodidConsole } from "./composables/useNeodidConsole";

defineMiniApp({
  appId: "miniapp-oracle-neodid-console",
  playArea: PlayArea,
  manifest,
  messages,

  setup(ctx) {
    const neodid = useNeodidConsole({
      oracle: ctx.services.oracle,
      t: ctx.t,
    });

    ctx.registerAction("resolveDid", async () => {
      await ctx.services.notify.guard(() => neodid.resolveDid(), "resultLoaded");
    });

    ctx.registerAction("loadProviders", async () => {
      await ctx.services.notify.guard(() => neodid.loadProviders(), "resultLoaded");
    });

    ctx.registerAction("applyExample", async (kind: unknown) => {
      neodid.applyExample(String(kind) as "service" | "vault" | "aa");
    });

    ctx.registerAction("updateDid", async (val: unknown) => {
      neodid.did.set(String(val));
    });

    ctx.registerAction("updateFormat", async (val: unknown) => {
      neodid.format.set(String(val));
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
