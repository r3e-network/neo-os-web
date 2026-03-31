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
@import url('https://fonts.googleapis.com/css2?family=Instrument+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap');

:global(body) {
  background: var(--anchor-bg, var(--bg-primary));
}

.trustanchor-play-area {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 24px 16px;
  min-height: 300px;
  font-family: var(--anchor-font, 'Instrument Sans', sans-serif);
  position: relative;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 250px;
    background: var(--anchor-depth-gradient, radial-gradient(ellipse at 50% 0%, rgba(3, 105, 161, 0.1) 0%, transparent 60%));
    pointer-events: none;
    z-index: 0;
  }

  > * {
    position: relative;
    z-index: 1;
  }
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.section-title {
  font-family: var(--anchor-font, 'Instrument Sans', sans-serif);
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--anchor-ocean, #0369A1);
}

.section-desc {
  font-family: var(--anchor-font, 'Instrument Sans', sans-serif);
  font-size: 14px;
  opacity: 0.82;
  line-height: 1.7;
  display: block;
  color: var(--anchor-text-muted, var(--text-secondary));
}

:deep(.neo-card) {
  font-family: var(--anchor-font, 'Instrument Sans', sans-serif);
  background: var(--anchor-card-bg, rgba(12, 24, 38, 0.85));
  border: 1px solid var(--anchor-card-border, rgba(3, 105, 161, 0.2));
  border-radius: 16px;
  box-shadow: var(--anchor-card-shadow, 0 8px 32px rgba(0, 0, 0, 0.25));
  backdrop-filter: blur(12px);
  transition: all 0.3s ease;
  position: relative;

  &:hover {
    border-color: rgba(3, 105, 161, 0.35);
    box-shadow:
      0 12px 40px rgba(0, 0, 0, 0.3),
      0 0 0 1px rgba(3, 105, 161, 0.08);
    transform: translateY(-1px);
  }

  &::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 20%;
    right: 20%;
    height: 1px;
    background: linear-gradient(90deg, transparent, var(--anchor-ocean, #0369A1), transparent);
    opacity: 0.2;
  }
}

:deep(.neo-btn--primary) {
  font-family: var(--anchor-font, 'Instrument Sans', sans-serif);
  background: linear-gradient(135deg, var(--anchor-ocean, #0369A1) 0%, var(--anchor-ocean-light, #0ea5e9) 100%);
  color: #fff;
  font-weight: 700;
  border: none;
  border-radius: 12px;
  box-shadow: 0 6px 20px var(--anchor-ocean-glow, rgba(3, 105, 161, 0.35));
  letter-spacing: 0.02em;
  transition: all 0.25s ease;

  &:hover {
    box-shadow: 0 8px 28px var(--anchor-ocean-glow, rgba(3, 105, 161, 0.35));
    transform: translateY(-1px);
  }
}

:deep(.neo-btn--secondary) {
  font-family: var(--anchor-font, 'Instrument Sans', sans-serif);
  background: var(--anchor-ocean-soft, rgba(3, 105, 161, 0.15));
  border: 1px solid rgba(3, 105, 161, 0.2);
  color: var(--anchor-ocean-light, #0ea5e9);
  border-radius: 10px;
  font-weight: 600;
  transition: all 0.25s ease;

  &:hover {
    background: rgba(3, 105, 161, 0.22);
    border-color: rgba(3, 105, 161, 0.35);
  }
}

:deep(.stats-display) {
  font-family: var(--anchor-font, 'Instrument Sans', sans-serif);
}

@media (prefers-reduced-motion: reduce) {
  :deep(.neo-card):hover,
  :deep(.neo-btn--primary):hover {
    transform: none;
  }
}
</style>
