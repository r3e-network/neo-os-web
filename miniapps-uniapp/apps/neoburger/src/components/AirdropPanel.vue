<template>
  <view class="page-shell airdrop-shell">
    <view class="page-hero fade-up">
      <image class="page-hero-logo" src="/static/neoburger-placeholder.svg" mode="widthFix" :alt="t('nobugAlt')" />
      <text class="page-hero-title">{{ t("airdropTitle") }}</text>
    </view>

    <view v-if="!walletConnected" class="card connect-card fade-up delay-1">
      <text class="section-text">{{ t("airdropConnectTip") }}</text>
      <NeoButton variant="primary" size="lg" block @click="emit('connectWallet')">
        {{ t("connectWallet") }}
      </NeoButton>
    </view>

    <view class="card fade-up delay-2">
      <text class="section-title">{{ t("nobugWhatIsTitle") }}</text>
      <text class="section-text">{{ t("nobugWhatIsDesc1") }}</text>
      <text class="section-text">{{ t("nobugWhatIsDesc2") }}</text>

      <view class="token-card">
        <view class="token-row">
          <text class="token-label">{{ t("nobugSymbol") }}</text>
          <text class="token-value">{{ t("nobugSymbolValue") }}</text>
        </view>
        <view class="token-row">
          <text class="token-label">{{ t("nobugDecimals") }}</text>
          <text class="token-value">{{ t("nobugDecimalsValue") }}</text>
        </view>
        <view class="token-row">
          <text class="token-label">{{ t("nobugTotalSupply") }}</text>
          <text class="token-value">{{ t("placeholderDash") }}</text>
        </view>
        <view class="token-divider"></view>
        <text class="token-subtitle">{{ t("nobugDistributionTitle") }}</text>
        <view class="distribution-grid">
          <view class="dist-item">
            <text class="dist-percent">{{ t("percent25") }}</text>
            <text class="dist-text">{{ t("nobugDistribution25") }}</text>
          </view>
          <view class="dist-item">
            <text class="dist-percent">{{ t("percent75") }}</text>
            <text class="dist-text">{{ t("nobugDistribution75") }}</text>
          </view>
        </view>
      </view>
    </view>

    <view class="card fade-up delay-3">
      <text class="section-title">{{ t("nobugUsageTitle") }}</text>
      <view class="usage-tabs">
        <view v-for="item in nobugUsageTabs" :key="item" class="usage-tab">
          <image
            class="usage-vector"
            src="/static/neoburger-placeholder.svg"
            mode="widthFix"
            :alt="t('vectorAlt')"
          />
          <text class="usage-text">{{ item }}</text>
          <image class="usage-vector" src="/static/neoburger-placeholder.svg" mode="widthFix" :alt="t('vectorAlt')" />
        </view>
      </view>
      <text class="section-text">{{ t("nobugUsageDesc1") }}</text>
      <text class="section-text">{{ t("nobugUsageDesc2") }}</text>
    </view>

    <view class="card fade-up delay-4">
      <text class="section-title">{{ t("nobugDistributionDetailsTitle") }}</text>
      <view class="distribution-block">
        <text class="dist-percent large">{{ t("percent25") }}</text>
        <text class="section-subtitle">{{ t("nobugContributorsTitle") }}</text>
        <text class="section-label">{{ t("nobugContributorsWho") }}</text>
        <text class="section-text">{{ t("nobugContributorsWhoDesc") }}</text>
        <text class="section-label">{{ t("nobugContributorsPlanTitle") }}</text>
        <text class="section-text">{{ t("nobugContributorsPlanDesc1") }}</text>
        <text class="section-text">{{ t("nobugContributorsPlanDesc2") }}</text>
      </view>
      <view class="distribution-block">
        <text class="dist-percent large">{{ t("percent75") }}</text>
        <text class="section-subtitle">{{ t("nobugOnChainTitle") }}</text>
        <view class="bullet-list">
          <text v-for="item in nobugOnChainRelease" :key="item" class="bullet-item">{{ item }}</text>
        </view>
        <text class="section-label">{{ t("nobugDistributionWaysTitle") }}</text>
        <text class="section-text">{{ t("nobugDistributionWayAirdrop") }}</text>
        <view class="bullet-list">
          <text v-for="item in nobugAirdropWays" :key="item" class="bullet-item">{{ item }}</text>
        </view>
        <text class="section-text">{{ t("nobugDistributionWayTbd") }}</text>
        <view class="bullet-list">
          <text v-for="item in nobugTbdWays" :key="item" class="bullet-item">{{ item }}</text>
        </view>
      </view>
    </view>
  </view>
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
