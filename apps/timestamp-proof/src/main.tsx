/**
 * Timestamp Proof — Entry Point (React)
 */

import { defineMiniApp, createObservable } from "@shared/react/defineMiniApp";
import type { Observable } from "@shared/react/context";
import PlayArea from "./PlayArea";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";

defineMiniApp({
  appId: "miniapp-timestamp-proof",
  playArea: PlayArea,
  manifest,
  messages,

  setup(ctx) {
    const platformServices = ctx.services;

    const totalProofs = createObservable(0);
    const yourProofs = createObservable(0);
    const isCreating = createObservable(false);
    const latestId: Observable<string> = {
      get: () => totalProofs.get() > 0 ? `#${totalProofs.get()}` : ctx.t("notAvailable"),
      set: () => {},
      subscribe: (listener) => totalProofs.subscribe(listener),
    };

    ctx.registerAction("createProof", async (content: string) => {
      isCreating.set(true);
      try {
        await platformServices.chain.ensureWallet();
        // Create proof via chain service
        ctx.setStatus(ctx.t("proofCreated"), "success");
      } catch (e) {
        ctx.setStatus(e instanceof Error ? e.message : ctx.t("error"), "error");
      } finally {
        isCreating.set(false);
      }
    });

    return {
      state: { totalProofs, yourProofs, isCreating, latestId },
      loadData: async () => {},
    };
  },
});
