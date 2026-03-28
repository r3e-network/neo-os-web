/**
 * Time Capsule — Entry Point (New Pattern)
 */

import { ref, computed } from "vue";
import { defineMiniApp } from "@shared/utils/defineMiniApp";
import { PlatformServices } from "@shared/services";
import PlayArea from "./PlayArea.vue";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";

defineMiniApp({
  appId: "miniapp-time-capsule",
  playArea: PlayArea,
  manifest,
  messages,

  setup(ctx) {
    const platformServices = PlatformServices.create("miniapp-time-capsule", {
      t: ctx.t as (key: string) => string,
    });

    const capsules = ref<Array<{ locked: boolean; revealed: boolean }>>([]);
    const totalCapsules = computed(() => capsules.value.length);
    const lockedCount = computed(() => capsules.value.filter((c) => c.locked).length);
    const revealedCount = computed(() => capsules.value.filter((c) => c.revealed).length);

    return {
      state: {
        address: platformServices.chain.address,
        totalCapsules,
        lockedCount,
        revealedCount,
        capsules,
      },
      loadData: async () => {},
      cleanup: () => { platformServices.destroy(); },
    };
  },
});
