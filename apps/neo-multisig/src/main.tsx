/**
 * Neo Multisig — Entry Point (React)
 */

import { defineMiniApp, createObservable, refsToObservables } from "@shared/react";
import PlayArea from "./PlayArea";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import { useMultisigHistory } from "./composables/useMultisigHistory";
import { useMultisigUI } from "./composables/useMultisigUI";

defineMiniApp({
  appId: "miniapp-neo-multisig",
  playArea: PlayArea,
  manifest,
  messages,

  setup(ctx) {
    const { history, pendingCount, completedCount } = useMultisigHistory();
    const totalTxs = createObservable(0);

    ctx.registerAction("navigateToCreate", async () => {
      uni.navigateTo({ url: "/pages/create/index" });
    });

    ctx.registerAction("loadTransaction", async (...args: unknown[]) => {
      const id = args[0] as string;
      if (id) {
        uni.navigateTo({ url: `/pages/sign/index?id=${id}` });
      }
    });

    return {
      state: refsToObservables({
        history,
        pendingCount,
        completedCount,
        totalTxs,
      }),
      loadData: async () => {},
    };
  },
});
