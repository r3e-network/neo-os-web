/**
 * Neo Swap — Entry Point (New Pattern)
 *
 * Uses defineMiniApp() to wire the swap state to the platform.
 */

import { ref, computed } from "vue";
import { defineMiniApp } from "@shared/utils/defineMiniApp";
import { PlatformServices } from "@shared/services";
import PlayArea from "./PlayArea.vue";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";

const popularPairs = [
  { id: "neo-gas", name: "NEO/GAS", rate: "1:45.2" },
  { id: "gas-bneo", name: "GAS/bNEO", rate: "1:0.95" },
  { id: "neo-flm", name: "NEO/FLM", rate: "1:125.8" },
];

defineMiniApp({
  appId: "miniapp-neo-swap",
  playArea: PlayArea,
  manifest,
  messages,

  setup(ctx) {
    const platformServices = PlatformServices.create("miniapp-neo-swap", {
      t: ctx.t as (key: string) => string,
    });

    const selectedPair = ref("neo-gas");
    const currentRate = computed(
      () => popularPairs.find((p) => p.id === selectedPair.value)?.rate ?? ctx.t("notAvailable"),
    );
    const selectedPairDisplay = computed(() => selectedPair.value.toUpperCase());
    const pairCount = computed(() => popularPairs.length);

    ctx.registerAction("selectPair", (pairId: string) => {
      selectedPair.value = pairId;
    });

    return {
      state: {
        // Manifest-bound stats/sidebar values
        selectedPairDisplay,
        pairCount,
        currentRate,

        // PlayArea state
        selectedPair,
      },

      loadData: async () => {
        // Swap data is currently static; future: load from chain
      },

      cleanup: () => {
        platformServices.destroy();
      },
    };
  },
});
