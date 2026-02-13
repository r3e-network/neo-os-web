import { computed, type Ref } from "vue";
import { createUseI18n } from "@shared/composables/useI18n";
import { messages } from "@/locale/messages";

export function useNeoburgerRewards(
  bNeoBalance: Ref<number>,
  apy: Ref<number>,
  priceData: Ref<{ neo: { usd: number } } | null>
) {
  const { t } = createUseI18n(messages)();

  const dailyRewards = computed(() => (bNeoBalance.value * (apy.value / 100 / 365)).toFixed(4));

  const weeklyRewards = computed(() => (bNeoBalance.value * (apy.value / 100 / 52)).toFixed(4));

  const monthlyRewards = computed(() => (bNeoBalance.value * (apy.value / 100 / 12)).toFixed(4));

  const totalRewards = computed(() => {
    const monthly = parseFloat(monthlyRewards.value);
    return Number.isFinite(monthly) ? monthly : 0;
  });

  const totalRewardsUsd = computed(() => {
    const neoPrice = priceData.value?.neo.usd ?? 0;
    return (totalRewards.value * neoPrice).toFixed(2);
  });

  const totalRewardsUsdText = computed(() => t("approxUsd", { value: totalRewardsUsd.value }));

  return {
    dailyRewards,
    weeklyRewards,
    monthlyRewards,
    totalRewards,
    totalRewardsUsd,
    totalRewardsUsdText,
  };
}
