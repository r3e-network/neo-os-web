<template>
  <div class="page-shell airdrop-shell">
    <div class="page-hero fade-up">
      <img class="page-hero-logo" src="/static/neoburger-placeholder.svg" mode="widthFix" :alt="t('nobugAlt')" />
      <span class="page-hero-title">{{ t("airdropTitle") }}</span>
    </div>

    <div v-if="!walletConnected" class="card connect-card fade-up delay-1">
      <span class="section-text">{{ t("airdropConnectTip") }}</span>
      <NeoButton variant="primary" size="lg" block @click="emit('connectWallet')">
        {{ t("connectWallet") }}
      </NeoButton>
    </div>

    <div class="card fade-up delay-2">
      <span class="section-title">{{ t("nobugWhatIsTitle") }}</span>
      <span class="section-text">{{ t("nobugWhatIsDesc1") }}</span>
      <span class="section-text">{{ t("nobugWhatIsDesc2") }}</span>

      <div class="token-card">
        <div class="token-row">
          <span class="token-label">{{ t("nobugSymbol") }}</span>
          <span class="token-value">{{ t("nobugSymbolValue") }}</span>
        </div>
        <div class="token-row">
          <span class="token-label">{{ t("nobugDecimals") }}</span>
          <span class="token-value">{{ t("nobugDecimalsValue") }}</span>
        </div>
        <div class="token-row">
          <span class="token-label">{{ t("nobugTotalSupply") }}</span>
          <span class="token-value">{{ t("placeholderDash") }}</span>
        </div>
        <div class="token-divider"></div>
        <span class="token-subtitle">{{ t("nobugDistributionTitle") }}</span>
        <div class="distribution-grid">
          <div class="dist-item">
            <span class="dist-percent">{{ t("percent25") }}</span>
            <span class="dist-text">{{ t("nobugDistribution25") }}</span>
          </div>
          <div class="dist-item">
            <span class="dist-percent">{{ t("percent75") }}</span>
            <span class="dist-text">{{ t("nobugDistribution75") }}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="card fade-up delay-3">
      <span class="section-title">{{ t("nobugUsageTitle") }}</span>
      <div class="usage-tabs">
        <div v-for="item in nobugUsageTabs" :key="item" class="usage-tab">
          <img
            class="usage-vector"
            src="/static/neoburger-placeholder.svg"
            mode="widthFix"
            :alt="t('vectorAlt')"
          />
          <span class="usage-text">{{ item }}</span>
          <img class="usage-vector" src="/static/neoburger-placeholder.svg" mode="widthFix" :alt="t('vectorAlt')" />
        </div>
      </div>
      <span class="section-text">{{ t("nobugUsageDesc1") }}</span>
      <span class="section-text">{{ t("nobugUsageDesc2") }}</span>
    </div>

    <div class="card fade-up delay-4">
      <span class="section-title">{{ t("nobugDistributionDetailsTitle") }}</span>
      <div class="distribution-block">
        <span class="dist-percent large">{{ t("percent25") }}</span>
        <span class="section-subtitle">{{ t("nobugContributorsTitle") }}</span>
        <span class="section-label">{{ t("nobugContributorsWho") }}</span>
        <span class="section-text">{{ t("nobugContributorsWhoDesc") }}</span>
        <span class="section-label">{{ t("nobugContributorsPlanTitle") }}</span>
        <span class="section-text">{{ t("nobugContributorsPlanDesc1") }}</span>
        <span class="section-text">{{ t("nobugContributorsPlanDesc2") }}</span>
      </div>
      <div class="distribution-block">
        <span class="dist-percent large">{{ t("percent75") }}</span>
        <span class="section-subtitle">{{ t("nobugOnChainTitle") }}</span>
        <div class="bullet-list">
          <span v-for="item in nobugOnChainRelease" :key="item" class="bullet-item">{{ item }}</span>
        </div>
        <span class="section-label">{{ t("nobugDistributionWaysTitle") }}</span>
        <span class="section-text">{{ t("nobugDistributionWayAirdrop") }}</span>
        <div class="bullet-list">
          <span v-for="item in nobugAirdropWays" :key="item" class="bullet-item">{{ item }}</span>
        </div>
        <span class="section-text">{{ t("nobugDistributionWayTbd") }}</span>
        <div class="bullet-list">
          <span v-for="item in nobugTbdWays" :key="item" class="bullet-item">{{ item }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { createUseI18n } from "@shared/composables/useI18n";
import { messages } from "@/locale/messages";
import { NeoButton } from "@shared/components";

const { t } = createUseI18n(messages)();

defineProps<{
  walletConnected: boolean;
}>();

const emit = defineEmits<{
  (e: "connectWallet"): void;
}>();

const nobugUsageTabs = computed(() => [t("nobugUsageRaise"), t("nobugUsageVote"), t("nobugUsageDelegate")]);

const nobugOnChainRelease = computed(() => [t("nobugOnChainRelease1"), t("nobugOnChainRelease2")]);

const nobugAirdropWays = computed(() => [t("nobugDistributionWayCommunity"), t("nobugDistributionWayEarlyUsers")]);

const nobugTbdWays = computed(() => [
  t("nobugDistributionWayOnChainMining"),
  t("nobugDistributionWayStake"),
  t("nobugDistributionWayTbdItem"),
]);
</script>

<style lang="scss" scoped>
.page-shell {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.page-hero {
  display: flex;
  align-items: center;
  gap: 12px;
}

.page-hero-logo {
  width: 40px;
}

.page-hero-title {
  font-family: "Bebas Neue", "Manrope", sans-serif;
  font-size: 32px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.card {
  background: var(--burger-surface);
  border-radius: 20px;
  padding: 18px;
  border: 1px solid var(--burger-border);
  box-shadow: var(--burger-card-shadow);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.connect-card {
  gap: 16px;
}

.section-title {
  font-family: "Bebas Neue", "Manrope", sans-serif;
  font-size: 28px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.section-text {
  font-size: 13px;
  line-height: 1.6;
  color: var(--burger-text-soft);
}

.token-card {
  background: var(--burger-surface-alt);
  border-radius: 16px;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.token-row {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  font-weight: 600;
}

.token-divider {
  height: 1px;
  background: var(--burger-border);
  margin: 6px 0;
}

.token-subtitle {
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--burger-text-soft);
  font-weight: 700;
}

.distribution-grid {
  display: grid;
  gap: 10px;
}

.dist-item {
  display: flex;
  align-items: center;
  gap: 10px;
}

.dist-percent {
  font-weight: 800;
  font-size: 20px;
  color: var(--burger-accent-deep);
}

.dist-percent.large {
  font-size: 28px;
}

.dist-text {
  font-size: 12px;
  color: var(--burger-text-soft);
}

.usage-tabs {
  display: grid;
  gap: 10px;
}

.usage-tab {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  background: var(--burger-surface-alt);
  border-radius: 16px;
  padding: 10px 12px;
  border: 1px solid var(--burger-border);
}

.usage-text {
  font-weight: 700;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.usage-vector {
  width: 16px;
}

.distribution-block {
  padding: 12px 0;
  border-top: 1px solid var(--burger-border);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.distribution-block:first-of-type {
  border-top: none;
}

.section-subtitle {
  font-size: 13px;
  font-weight: 700;
}

.section-label {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  font-weight: 700;
  color: var(--burger-text-muted);
}

.bullet-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.bullet-item {
  font-size: 12px;
  color: var(--burger-text-soft);
}

.fade-up {
  animation: fadeUp 0.8s ease both;
}

.delay-1 {
  animation-delay: 0.1s;
}

.delay-2 {
  animation-delay: 0.2s;
}

.delay-3 {
  animation-delay: 0.3s;
}

.delay-4 {
  animation-delay: 0.4s;
}

@keyframes fadeUp {
  from {
    opacity: 0;
    transform: translateY(14px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
