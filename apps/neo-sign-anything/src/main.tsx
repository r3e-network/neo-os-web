/**
 * Neo Sign Anything — Entry Point (React)
 *
 * This app is a thin wrapper around wallet signing and GAS self-transfer
 * broadcast. All chain calls target the native GAS contract (external),
 * so they stay on ctx.services.chain. Session counters are persisted
 * via ctx.os.storage so they survive page reloads.
 */

import { defineMiniApp } from "@shared/react/defineMiniApp";
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
      app: ctx.framework,
      chain: ctx.services.chain,
      eventBus: ctx.services.events,
      clipboard: ctx.services.clipboard,
      storage: ctx.os.storage,
      t: ctx.t,
    });

    ctx.framework.actions.register("signMessage", async (...args: unknown[]) => {
      await notify.guard(
        () => signAnything.signMessage(String(args[0] ?? "")),
        "signSuccess",
      );
    });

    ctx.framework.actions.register("broadcastMessage", async (...args: unknown[]) => {
      await notify.guard(
        () => signAnything.broadcastMessage(String(args[0] ?? "")),
        "broadcastSuccess",
      );
    });

    ctx.framework.actions.register("copyToClipboard", async (...args: unknown[]) => {
      await signAnything.copyToClipboard(String(args[0] ?? ""));
    });
    ctx.framework.actions.register("loadFileDigest", async (...args: unknown[]) => {
      const file = args[0];
      if (file instanceof File) {
        await notify.guard(() => signAnything.loadFileDigest(file), "fileHashed");
      }
    });
    ctx.framework.actions.register("setMessage", async (...args: unknown[]) => {
      signAnything.message.set(String(args[0] ?? ""));
    });

    return {
      state: {
        address: signAnything.address,
        message: signAnything.message,
        signature: signAnything.signature,
        publicKey: signAnything.publicKey,
        txHash: signAnything.txHash,
        txPending: signAnything.txPending,
        isSigning: signAnything.isSigning,
        isBroadcasting: signAnything.isBroadcasting,
        signCount: signAnything.signCount,
        broadcastCount: signAnything.broadcastCount,
      },
      loadData: signAnything.loadData,
    };
  },
});
