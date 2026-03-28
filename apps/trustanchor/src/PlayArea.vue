<template>
  <div class="trustanchor-play-area">
    <!-- Hero -->
    <AnchorGaugeHero
      :t="t"
      :totalStaked="stats?.totalStaked ?? 0"
      :agentCount="agentAccounts.length"
    />

    <!-- Overview Stats -->
    <StatsDisplay :items="overviewStats" layout="grid" class="mb-6" />

    <NeoCard variant="erobo" class="mb-4 px-1">
      <div class="section-header mb-4">
        <span class="section-title">{{ t("routingSummaryTitle") }}</span>
      </div>
      <span class="section-desc">{{ t("routingSummaryDesc") }}</span>
    </NeoCard>

    <NeoCard variant="erobo" class="px-1">
      <div class="section-header mb-4">
        <span class="section-title">{{ t("rebalanceTitle") }}</span>
      </div>
      <span class="section-desc">{{ t("rebalanceDesc") }}</span>
    </NeoCard>

    <!-- Operation Panel: Stake/Unstake/Claim -->
    <StakeOperationPanel
      :t="t"
      :pendingRewards="pendingRewards"
      :pendingWithdraw="pendingWithdraw"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { Ref } from "vue";
import { StatsDisplay, NeoCard } from "@shared/components";
import type { StatsDisplayItem } from "@shared/components";
import type { TrustAnchorStats } from "./composables/useTrustAnchor";
import AnchorGaugeHero from "./components/AnchorGaugeHero.vue";
import StakeOperationPanel from "./components/StakeOperationPanel.vue";

const props = defineProps<{
  t: (key: string, params?: Record<string, string | number>) => string;
  state: Record<string, Ref<unknown>>;
}>();

const t = (key: string, params?: Record<string, string | number>) => props.t(key, params);

const stats = computed(() => props.state.stats?.value as TrustAnchorStats | null);
const pendingRewards = computed(() => Number(props.state.pendingRewards?.value ?? 0));
const pendingWithdraw = computed(() => Number(props.state.pendingWithdraw?.value ?? 0));
const agentAccounts = computed(() => (props.state.agentAccounts?.value ?? []) as Array<Record<string, unknown>>);

const overviewStats = computed<StatsDisplayItem[]>(() => [
  { label: t("zeroFee"), value: t("zeroFeeDesc"), variant: "success" },
  { label: t("verificationAccountsTitle"), value: t("verificationAccountsDesc"), variant: "erobo" },
  { label: t("verificationScriptTitle"), value: t("verificationScriptDesc"), variant: "accent" },
  { label: t("rebalanceTitle"), value: t("rebalanceMetricDesc"), variant: "erobo" },
]);
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@use "./pages/index/trustanchor-theme.scss" as *;

:global(body) {
  background: var(--bg-primary);
}

.trustanchor-play-area {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.section-title {
  font-size: 16px;
  font-weight: 800;
}

.section-desc {
  font-size: 14px;
  opacity: 0.82;
  line-height: 1.7;
  display: block;
}
</style>
