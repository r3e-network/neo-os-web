/**
 * Neo Sign Anything — Entry Point (New Pattern)
 */

import { defineMiniApp } from "@shared/utils/defineMiniApp";
import { PlatformServices } from "@shared/services";
import PlayArea from "./PlayArea.vue";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import { useSignAnything } from "./composables/useSignAnything";

defineMiniApp({
  appId: "miniapp-neo-sign-anything",
  playArea: PlayArea,
  manifest,
  messages,

  setup(ctx) {
    const platformServices = PlatformServices.create("miniapp-neo-sign-anything", {
      t: ctx.t as (key: string) => string,
    });

    const signAnything = useSignAnything({
      chain: platformServices.chain,
      eventBus: platformServices.events,
      clipboard: platformServices.clipboard,
      t: ctx.t,
    });

    ctx.registerAction("signMessage", async (msg: string) => {
      try {
        await signAnything.signMessage(msg);
        ctx.setStatus(ctx.t("copySuccess"), "success");
      } catch (e) {
        ctx.setStatus(e instanceof Error ? e.message : ctx.t("error"), "error");
      }
    });

    ctx.registerAction("broadcastMessage", async (msg: string) => {
      try {
        await signAnything.broadcastMessage(msg);
        ctx.setStatus(ctx.t("broadcastSuccess"), "success");
      } catch (e) {
        ctx.setStatus(e instanceof Error ? e.message : ctx.t("error"), "error");
      }
    });

    ctx.registerAction("copyToClipboard", async (text: string) => {
      await signAnything.copyToClipboard(text);
    });

    return {
      state: {
        address: signAnything.address,
        signature: signAnything.signature,
        txHash: signAnything.txHash,
        isSigning: signAnything.isSigning,
        isBroadcasting: signAnything.isBroadcasting,
        signCount: signAnything.signCount,
        broadcastCount: signAnything.broadcastCount,
      },
      loadData: signAnything.loadData,
      cleanup: () => { platformServices.destroy(); },
    };
  },
});
