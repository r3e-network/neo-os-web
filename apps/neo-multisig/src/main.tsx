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
      ctx.setStatus(ctx.t("createNotAvailable") || "Create flow not available in this build", "info");
    });

    ctx.registerAction("loadTransaction", async (...args: unknown[]) => {
      const id = args[0] as string;
      if (!id) return;
      ctx.setStatus(ctx.t("signNotAvailable") || `Sign flow for ${id} not available in this build`, "info");
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
