/**
 * Neo Sign Anything — Entry Point (React)
 *
 * This app is a thin wrapper around wallet signing and GAS self-transfer
 * broadcast, fully on the framework SDK: signing via app.chain.signMessage,
 * the broadcast invoke via app.chain (native GAS contract), toasts via
 * app.notify, clipboard via app.clipboard, and session counters via
 * app.storage.remote so they survive page reloads.
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
    const app = ctx.framework;

    const signAnything = useSignAnything({
      app,
      t: ctx.t,
    });

    app.actions.register(
      "signMessage",
      (...args: unknown[]) => signAnything.signMessage(String(args[0] ?? "")),
      { successKey: "signSuccess" },
    );

    app.actions.register(
      "broadcastMessage",
      (...args: unknown[]) => signAnything.broadcastMessage(String(args[0] ?? "")),
      { successKey: "broadcastSuccess" },
    );

    app.actions.register("copyToClipboard", async (...args: unknown[]) => {
      await signAnything.copyToClipboard(String(args[0] ?? ""));
    });
    app.actions.register("loadFileDigest", async (...args: unknown[]) => {
      const file = args[0];
      if (file instanceof File) {
        await app.notify.guard(() => signAnything.loadFileDigest(file), {
          successKey: "fileHashed",
        });
      }
    });
    app.actions.register("setMessage", async (...args: unknown[]) => {
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
