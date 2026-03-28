/**
 * neodid-passport — Entry Point (New Pattern)
 */

import { ref, computed } from "vue";
import { defineMiniApp } from "@shared/utils/defineMiniApp";
import { PlatformServices } from "@shared/services";
import PlayArea from "./PlayArea.vue";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";

defineMiniApp({
  appId: "miniapp-neodid-passport",
  playArea: PlayArea,
  manifest,
  messages,

  setup(ctx) {
    const platformServices = PlatformServices.create("miniapp-neodid-passport", {
      t: ctx.t as (key: string) => string,
    });

    const latestPayload = ref<Record<string, unknown> | null>(null);
    const isLoading = ref(false);
    const did = ref("did:morpheus:neo_n3:service:neodid");
    const format = ref("resolution");
    const providerCount = ref(0);
    const secretName = ref("passport-ref");

    const renderedPayload = computed(() =>
      latestPayload.value ? JSON.stringify(latestPayload.value, null, 2) : ctx.t("notAvailable"),
    );

    return {
      state: {
        renderedPayload,
        isLoading,
        latestPayload,
        did,
        format,
        providerCount,
        secretName,
        availableActions: ref([]),
      },
      loadData: async () => {},
      cleanup: () => { platformServices.destroy(); },
    };
  },
});
