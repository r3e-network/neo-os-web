/**
 * Neo Treasury — Entry Point (New Pattern)
 */

import { ref, computed } from "vue";
import { defineMiniApp } from "@shared/utils/defineMiniApp";
import PlayArea from "./PlayArea.vue";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import { formatErrorMessage } from "@shared/utils/errorHandling";
import { readCachedJSON, writeCachedJSON } from "@shared/utils/runtime-cache";
import { fetchTreasuryData } from "./utils/treasury";

const CACHE_KEY = "neo_treasury_cache";

interface TreasuryData {
  totalUsd: number;
  totalNeo: number;
  totalGas: number;
  lastUpdated: string;
  prices: Record<string, unknown>;
  categories: Array<{ name: string; [key: string]: unknown }>;
}

defineMiniApp({
  appId: "miniapp-neo-treasury",
  playArea: PlayArea,
  manifest,
  messages,

  setup(ctx) {
    const platformServices = ctx.services;

    const loading = ref(true);
    const error = ref("");
    const data = ref<TreasuryData | null>(null);

    const totalUsdDisplay = computed(() =>
      data.value?.totalUsd
        ? `${ctx.t("currencySymbol")}${data.value.totalUsd.toLocaleString()}`
        : ctx.t("notAvailable"),
    );
    const totalNeoDisplay = computed(
      () => data.value?.totalNeo?.toLocaleString() ?? ctx.t("notAvailable"),
    );
    const totalGasDisplay = computed(
      () => data.value?.totalGas?.toLocaleString() ?? ctx.t("notAvailable"),
    );
    const founderCount = computed(() => data.value?.categories?.length ?? 0);

    const loadData = async () => {
      loading.value = true;
      error.value = "";

      try {
        const cached = readCachedJSON<TreasuryData>(CACHE_KEY);
        if (cached) {
          data.value = cached;
        }
      } catch (_e) {
        console.warn(
          "[neo-treasury] cache read failed:",
          _e instanceof Error ? _e.message : String(_e),
        );
      }

      try {
        const freshData = await fetchTreasuryData();
        data.value = freshData;
        writeCachedJSON(CACHE_KEY, freshData);
      } catch (e) {
        if (!data.value) {
          error.value = formatErrorMessage(e, ctx.t("loadFailed"));
        } else {
          console.warn(
            "[neo-treasury] using cached data:",
            e instanceof Error ? e.message : String(e),
          );
        }
      } finally {
        loading.value = false;
      }
    };

    ctx.registerAction("refresh", async () => {
      await loadData();
    });

    return {
      state: {
        loading,
        error,
        data,
        totalUsdDisplay,
        totalNeoDisplay,
        totalGasDisplay,
        founderCount,
      },

      loadData,
    };
  },
});
