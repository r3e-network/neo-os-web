/**
 * recovery-guardian — Entry Point (New Pattern)
 */

import { ref, computed } from "vue";
import { defineMiniApp } from "@shared/utils/defineMiniApp";
import { PlatformServices } from "@shared/services";
import PlayArea from "./PlayArea.vue";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";

defineMiniApp({
  appId: "miniapp-recovery-guardian",
  playArea: PlayArea,
  manifest,
  messages,

  setup(ctx) {
    const platformServices = PlatformServices.create("miniapp-recovery-guardian", {
      t: ctx.t as (key: string) => string,
    });

    const latestPayload = ref<Record<string, unknown> | null>(null);
    const isLoading = ref(false);

    const renderedPayload = computed(() =>
      latestPayload.value ? JSON.stringify(latestPayload.value, null, 2) : ctx.t("notAvailable"),
    );

    const accountId = computed(() => String(latestPayload.value?.account_id || ctx.t("notAvailable")));
    const verifierHash = computed(() => String(latestPayload.value?.verifier_hash || ctx.t("notAvailable")));
    const threshold = computed(() => String(latestPayload.value?.threshold || ctx.t("notAvailable")));
    const timelock = computed(() => String(latestPayload.value?.timelock || ctx.t("notAvailable")));

    return {
      state: {
        renderedPayload,
        isLoading,
        latestPayload,
        accountId,
        verifierHash,
        threshold,
        timelock,
        availableActions: ref([]),
      },
      loadData: async () => {},
      cleanup: () => { platformServices.destroy(); },
    };
  },
});
