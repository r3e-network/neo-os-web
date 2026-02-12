import { ref, computed, onUnmounted } from "vue";
import type { PriceData } from "@shared/utils/price";
import { getPrices } from "@shared/utils/price";
import { formatCompactNumber } from "@shared/utils/format";
import type { UniAppGlobals } from "@shared/types/globals";
import { useI18n } from "@/composables/useI18n";

const APY_CACHE_KEY = "neoburger_apy_cache";
const STATS_ENDPOINTS = ["/api/neoburger-stats", "/api/neoburger/stats"];
const LOCAL_STATS_MOCK = {
  apy: 12.8,
  total_staked: 1425367,
  total_staked_formatted: "1.43M",
};
const isLocalPreview =
  typeof window !== "undefined" && ["127.0.0.1", "localhost"].includes(window.location.hostname);

export function useNeoburgerStats() {
  const { t } = useI18n();

  const apy = ref(0);
  const animatedApy = ref("0.0");
  const loadingApy = ref(true);
  const priceData = ref<PriceData | null>(null);
  const totalStaked = ref<number | null>(null);
  const totalStakedFormatted = ref<string | null>(null);

  let apyAnimationTimer: ReturnType<typeof setInterval> | null = null;

  const aprDisplay = computed(() =>
    loadingApy.value ? t("apyPlaceholder") : `${animatedApy.value}%`,
  );

  const totalStakedDisplay = computed(() => {
    if (totalStakedFormatted.value) return totalStakedFormatted.value;
    if (totalStaked.value === null) return t("placeholderDash");
    return formatCompactNumber(totalStaked.value);
  });

  const totalStakedUsdText = computed(() => {
    const price = priceData.value?.neo.usd ?? 0;
    if (!price || totalStaked.value === null) return t("usdPlaceholder");
    return t("approxUsd", { value: formatCompactNumber(totalStaked.value * price) });
  });

  function animateApy() {
    const target = apy.value;
    const duration = 2000;
    const steps = 60;
    const increment = target / steps;
    let current = 0;
    let step = 0;

    if (apyAnimationTimer) clearInterval(apyAnimationTimer);

    apyAnimationTimer = setInterval(() => {
      current += increment;
      step++;
      animatedApy.value = current.toFixed(1);
      if (step >= steps) {
        animatedApy.value = target.toFixed(1);
        if (apyAnimationTimer) {
          clearInterval(apyAnimationTimer);
          apyAnimationTimer = null;
        }
      }
    }, duration / steps);
  }

  const fetchStats = async () => {
    if (isLocalPreview) {
      return LOCAL_STATS_MOCK;
    }

    for (const endpoint of STATS_ENDPOINTS) {
      try {
        const response = await fetch(endpoint);
        if (!response.ok) continue;
        return await response.json();
      } catch {
        /* endpoint unreachable -- try next */
      }
    }
    return null;
  };

  const readCachedApy = () => {
    try {
      const g = globalThis as unknown as UniAppGlobals;
      const uniApi = g?.uni as Record<string, (...args: unknown[]) => unknown> | undefined;
      const raw =
        uniApi?.getStorageSync?.(APY_CACHE_KEY) ??
        (typeof localStorage !== "undefined" ? localStorage.getItem(APY_CACHE_KEY) : null);
      const value = Number(raw);
      return Number.isFinite(value) && value >= 0 ? value : null;
    } catch {
      return null;
    }
  };

  const writeCachedApy = (value: number) => {
    try {
      const g = globalThis as unknown as UniAppGlobals;
      const uniApi = g?.uni as Record<string, (...args: unknown[]) => unknown> | undefined;
      if (uniApi?.setStorageSync) {
        uniApi.setStorageSync(APY_CACHE_KEY, String(value));
      } else if (typeof localStorage !== "undefined") {
        localStorage.setItem(APY_CACHE_KEY, String(value));
      }
    } catch {
      /* APY cache write is non-critical */
    }
  };

  async function loadApy() {
    try {
      loadingApy.value = true;
      const cached = readCachedApy();
      if (cached !== null) apy.value = cached;
      const data = await fetchStats();
      if (data) {
        const nextApy = parseFloat(data.apy ?? data.apr);
        if (Number.isFinite(nextApy) && nextApy >= 0) {
          apy.value = nextApy;
          writeCachedApy(nextApy);
        }
        const nextTotalStaked = Number(data.total_staked ?? data.totalStakedNeo);
        if (Number.isFinite(nextTotalStaked) && nextTotalStaked >= 0) totalStaked.value = nextTotalStaked;
        const formatted = data.total_staked_formatted ?? data.totalStakedFormatted;
        if (typeof formatted === "string") totalStakedFormatted.value = formatted;
      }
    } catch (e: unknown) {
      /* non-critical: APY data fetch */
    } finally {
      loadingApy.value = false;
      animateApy();
    }
  }

  async function loadPrices() {
    try {
      priceData.value = await getPrices();
    } catch (e: unknown) {
      /* non-critical: price data fetch */
    }
  }

  function cleanup() {
    if (apyAnimationTimer) {
      clearInterval(apyAnimationTimer);
      apyAnimationTimer = null;
    }
  }

  onUnmounted(cleanup);

  return {
    apy,
    priceData,
    aprDisplay,
    totalStakedDisplay,
    totalStakedUsdText,
    loadApy,
    loadPrices,
    cleanup,
  };
}
