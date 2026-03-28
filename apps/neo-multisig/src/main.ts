/**
 * Neo Multisig — Entry Point (New Pattern)
 */

import { computed } from "vue";
import { defineMiniApp } from "@shared/utils/defineMiniApp";
import PlayArea from "./PlayArea.vue";
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
    const platformServices = ctx.services;

    const { history, pendingCount, completedCount } = useMultisigHistory();
    const { getStatusIcon, statusLabel, shorten, formatDate } = useMultisigUI();

    const totalTxs = computed(() => history.value.length);

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
      state: {
        history,
        pendingCount,
        completedCount,
        totalTxs,
      },

      loadData: async () => {
        // History is loaded from local storage on mount by the composable
      },
    };
  },
});
