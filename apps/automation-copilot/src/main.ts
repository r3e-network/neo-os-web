/**
 * automation-copilot — Entry Point (New Pattern)
 */

import { ref, computed } from "vue";
import { defineMiniApp } from "@shared/utils/defineMiniApp";
import { PlatformServices } from "@shared/services";
import PlayArea from "./PlayArea.vue";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";

defineMiniApp({
  appId: "miniapp-automation-copilot",
  playArea: PlayArea,
  manifest,
  messages,

  setup(ctx) {
    const platformServices = PlatformServices.create("miniapp-automation-copilot", {
      t: ctx.t as (key: string) => string,
    });

    const latestPayload = ref<Record<string, unknown> | null>(null);
    const isLoading = ref(false);
    const asset = ref("NEO");
    const targetPrice = ref("20");
    const schedule = ref("0 */6 * * *");
    const latestPrice = ref<number | null>(null);

    const renderedPayload = computed(() =>
      latestPayload.value ? JSON.stringify(latestPayload.value, null, 2) : ctx.t("notAvailable"),
    );

    const currentPrice = computed(() =>
      latestPrice.value == null ? ctx.t("notAvailable") : `$${latestPrice.value.toFixed(4)}`,
    );

    return {
      state: {
        renderedPayload,
        isLoading,
        latestPayload,
        asset,
        currentPrice,
        targetPrice,
        schedule,
        availableActions: ref([]),
      },
      loadData: async () => {},
      cleanup: () => { platformServices.destroy(); },
    };
  },
});
