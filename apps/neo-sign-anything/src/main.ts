/**
 * Neo Sign Anything — Entry Point (New Pattern)
 */

import { defineMiniApp } from "@shared/utils/defineMiniApp";
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
    const platformServices = ctx.services;

    const { notify } = platformServices;

    const signAnything = useSignAnything({
      chain: platformServices.chain,
      eventBus: platformServices.events,
      clipboard: platformServices.clipboard,
      t: ctx.t,
    });

    ctx.registerAction("signMessage", async (msg: string) => {
      await notify.guard(() => signAnything.signMessage(msg), "copySuccess");
    });

    ctx.registerAction("broadcastMessage", async (msg: string) => {
      await notify.guard(
        () => signAnything.broadcastMessage(msg),
        "broadcastSuccess",
      );
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
    };
  },
});
