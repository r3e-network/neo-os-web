/**
 * unbreakable-vault — Entry Point (New Pattern)
 */

import { ref, computed } from "vue";
import { defineMiniApp } from "@shared/utils/defineMiniApp";
import { PlatformServices } from "@shared/services";
import PlayArea from "./PlayArea.vue";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";

defineMiniApp({
  appId: "miniapp-unbreakablevault",
  playArea: PlayArea,
  manifest,
  messages,

  setup(ctx) {
    const platformServices = PlatformServices.create("miniapp-unbreakablevault", {
      t: ctx.t as (key: string) => string,
    });

    const myVaults = ref<unknown[]>([]);
    const recentVaults = ref<unknown[]>([]);
    const vaultDifficulty = ref(1);
    const ATTEMPT_FEE = 0.1;

    return {
      state: {
        address: platformServices.chain.address,
        myVaultCount: computed(() => myVaults.value.length),
        recentVaultCount: computed(() => recentVaults.value.length),
        vaultDifficulty,
        attemptFeeDisplay: computed(() => `${ATTEMPT_FEE} ${ctx.t("tokenGas")}`),
      },
      loadData: async () => {},
      cleanup: () => { platformServices.destroy(); },
    };
  },
});
