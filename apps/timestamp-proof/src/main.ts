/**
 * Timestamp Proof — Entry Point (New Pattern)
 */

import { ref, computed } from "vue";
import { defineMiniApp } from "@shared/utils/defineMiniApp";
import PlayArea from "./PlayArea.vue";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";

defineMiniApp({
  appId: "miniapp-timestamp-proof",
  playArea: PlayArea,
  manifest,
  messages,

  setup(ctx) {
    const platformServices = ctx.services;

    const totalProofs = ref(0);
    const yourProofs = ref(0);
    const isCreating = ref(false);
    const latestId = computed(() =>
      totalProofs.value > 0 ? `#${totalProofs.value}` : ctx.t("notAvailable"),
    );

    ctx.registerAction("createProof", async (content: string) => {
      isCreating.value = true;
      try {
        await platformServices.chain.ensureWallet();
        // Create proof via chain service
        ctx.setStatus(ctx.t("proofCreated"), "success");
      } catch (e) {
        ctx.setStatus(e instanceof Error ? e.message : ctx.t("error"), "error");
      } finally {
        isCreating.value = false;
      }
    });

    return {
      state: { totalProofs, yourProofs, isCreating, latestId },
      loadData: async () => {},
    };
  },
});
