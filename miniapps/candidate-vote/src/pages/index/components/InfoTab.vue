<template>
  <view class="tab-content scrollable">
    <NeoCard :title="t('aboutVoting')" variant="erobo-neo" class="mb-4">
      <view class="info-section">
        <text class="info-text">{{ t("votingDescription") }}</text>
      </view>
    </NeoCard>

    <NeoCard :title="t('howItWorks')" variant="erobo-neo" class="mb-4">
      <view class="steps-list">
        <view class="step-item">
          <view class="step-number">1</view>
          <text class="step-text">{{ t("step1") }}</text>
        </view>
        <view class="step-item">
          <view class="step-number">2</view>
          <text class="step-text">{{ t("step2") }}</text>
        </view>
        <view class="step-item">
          <view class="step-number">3</view>
          <text class="step-text">{{ t("step3") }}</text>
        </view>
      </view>
    </NeoCard>

    <NeoCard :title="t('yourWallet')" variant="erobo-neo">
      <NeoStats :stats="infoStats" />
    </NeoCard>
  </view>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { formatAddress } from "@shared/utils/format";
import { NeoCard, NeoStats, type StatItem } from "@shared/components";
import { useI18n } from "@/composables/useI18n";

const { t } = useI18n();

const props = defineProps<{
  address: string | null;
}>();

const infoStats = computed<StatItem[]>(() => [
  { label: t("wallet"), value: props.address ? formatAddress(props.address) : t("notConnected") },
  { label: t("votingPower"), value: props.address ? t("basedOnNeo") : "--" },
]);
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss";

.tab-content {
  padding: 20px;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.scrollable {
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

.info-section {
  padding: 8px 0;
}

.info-text {
  font-size: 14px;
  line-height: 1.6;
  color: var(--text-secondary, rgba(255, 255, 255, 0.7));
}

.steps-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.step-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.step-number {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: linear-gradient(135deg, #00e599 0%, #00b377 100%);
  color: #000;
  font-weight: 700;
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.step-text {
  font-size: 14px;
  line-height: 1.5;
  color: var(--text-primary, rgba(255, 255, 255, 0.9));
  padding-top: 4px;
}
</style>
