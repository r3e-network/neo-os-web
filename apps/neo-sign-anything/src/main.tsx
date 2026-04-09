/**
 * Neo Sign Anything — Entry Point (React)
 *
 * This app is a thin wrapper around wallet signing and GAS self-transfer
 * broadcast. All chain calls target the native GAS contract (external),
 * so they stay on ctx.services.chain. Session counters are persisted
 * via ctx.os.storage so they survive page reloads.
 */

import { defineMiniApp, createObservable } from "@shared/react/defineMiniApp";
import PlayArea from "./PlayArea";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import { useSignAnything } from "./composables/useSignAnything";

defineMiniApp({
  appId: "miniapp-neo-sign-anything",
  playArea: PlayArea,
  manifest,
  messages,

  setup(ctx) {
    const { notify } = ctx.services;

    const signAnything = useSignAnything({
      chain: ctx.services.chain,
      eventBus: ctx.services.events,
      clipboard: ctx.services.clipboard,
      storage: ctx.os.storage,
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
