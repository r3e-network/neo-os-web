<template>
  <view class="docs-container">
    <NeoCard :title="t('docTitle')" variant="accent" class="mb-4">
      <view class="hero-doc">
        <text class="doc-subtitle">{{ t("docSubtitle") }}</text>
        <text class="doc-description">{{ t("docDescription") }}</text>
      </view>
    </NeoCard>

    <!-- Contract Info -->
    <NeoCard :title="t('contractInfo')" class="mb-4">
      <view class="info-grid">
        <view class="info-item">
          <text class="info-label">{{ t("contractName") }}</text>
          <text class="info-value mono">MiniAppFlashLoan</text>
        </view>
        <view class="info-item">
          <text class="info-label">{{ t("version") }}</text>
          <text class="info-value">v2.0.0</text>
        </view>
        <view class="info-item">
          <text class="info-label">{{ t("minLoan") }}</text>
          <text class="info-value">1 GAS</text>
        </view>
        <view class="info-item">
          <text class="info-label">{{ t("maxLoan") }}</text>
          <text class="info-value">100,000 GAS</text>
        </view>
        <view class="info-item">
          <text class="info-label">{{ t("cooldown") }}</text>
          <text class="info-value">5 {{ t("minutes") }}</text>
        </view>
        <view class="info-item">
          <text class="info-label">{{ t("dailyLimit") }}</text>
          <text class="info-value">10 {{ t("loansPerDay") }}</text>
        </view>
        <view class="info-item">
          <text class="info-label">{{ t("network") }}</text>
          <text class="info-value">{{ networkLabel || t("neoN3Network") }}</text>
        </view>
        <view class="info-item">
          <text class="info-label">{{ t("protocolFee") }}</text>
          <text class="info-value highlight">0.09%</text>
        </view>
      </view>

      <view class="hash-box mt-4">
        <text class="info-label">{{ t("contractHash") }}</text>
        <view class="hash-value">
          <text class="mono-small">{{ contractAddress || t("notAvailable") }}</text>
        </view>
      </view>
    </NeoCard>

    <!-- Contract Methods -->
    <NeoCard :title="t('contractMethods')" class="mb-4">
      <view class="method-card">
        <view class="method-header">
          <text class="method-name">RequestLoan</text>
          <text class="method-badge write">{{ t("write") }}</text>
        </view>
        <text class="method-desc">{{ t("requestLoanDesc") }}</text>
        <view class="method-params">
          <text class="params-title">{{ t("parameters") }}:</text>
          <view class="param-item">
            <text class="param-name">borrower</text>
            <text class="param-type">Hash160</text>
            <text class="param-desc">{{ t("borrowerDesc") }}</text>
          </view>
          <view class="param-item">
            <text class="param-name">amount</text>
            <text class="param-type">Integer</text>
            <text class="param-desc">{{ t("amountDesc") }}</text>
          </view>
          <view class="param-item">
            <text class="param-name">callbackContract</text>
            <text class="param-type">Hash160</text>
            <text class="param-desc">{{ t("callbackContractDesc") }}</text>
          </view>
          <view class="param-item">
            <text class="param-name">callbackMethod</text>
            <text class="param-type">String</text>
            <text class="param-desc">{{ t("callbackMethodDesc") }}</text>
          </view>
        </view>
      </view>

      <view class="method-card">
        <view class="method-header">
          <text class="method-name">GetLoan</text>
          <text class="method-badge read">{{ t("read") }}</text>
        </view>
        <text class="method-desc">{{ t("getLoanDesc") }}</text>
        <view class="method-params">
          <text class="params-title">{{ t("parameters") }}:</text>
          <view class="param-item">
            <text class="param-name">loanId</text>
            <text class="param-type">Integer</text>
            <text class="param-desc">{{ t("loanIdentifier") }}</text>
          </view>
        </view>
      </view>

      <view class="method-card">
        <view class="method-header">
          <text class="method-name">GetPoolBalance</text>
          <text class="method-badge read">{{ t("read") }}</text>
        </view>
        <text class="method-desc">{{ t("getPoolBalanceDesc") }}</text>
      </view>

      <view class="method-card">
        <view class="method-header">
          <text class="method-name">Deposit</text>
          <text class="method-badge write">{{ t("write") }}</text>
        </view>
        <text class="method-desc">{{ t("depositDesc") }}</text>
        <view class="method-params">
          <text class="params-title">{{ t("parameters") }}:</text>
          <view class="param-item">
            <text class="param-name">depositor</text>
            <text class="param-type">Hash160</text>
            <text class="param-desc">{{ t("depositorDesc") }}</text>
          </view>
          <view class="param-item">
            <text class="param-name">amount</text>
            <text class="param-type">Integer</text>
            <text class="param-desc">{{ t("amountDesc") }}</text>
          </view>
        </view>
      </view>
    </NeoCard>

    <!-- Usage Steps -->
    <NeoCard :title="t('howToUse')" variant="success" class="mb-4">
      <view class="usage-steps">
        <view class="u-step">
          <view class="u-num">01</view>
          <view class="u-content">
            <text class="u-title">{{ t("deployCallbackTitle") }}</text>
            <text class="u-text">{{ t("deployCallbackDesc") }}</text>
          </view>
        </view>
        <view class="u-step">
          <view class="u-num">02</view>
          <view class="u-content">
            <text class="u-title">{{ t("callRequestLoanTitle") }}</text>
            <text class="u-text">{{ t("callRequestLoanDesc") }}</text>
          </view>
        </view>
        <view class="u-step">
          <view class="u-num">03</view>
          <view class="u-content">
            <text class="u-title">{{ t("teeVerificationTitle") }}</text>
            <text class="u-text">{{ t("teeVerificationDesc") }}</text>
          </view>
        </view>
        <view class="u-step">
          <view class="u-num">04</view>
          <view class="u-content">
            <text class="u-title">{{ t("repayCallbackTitle") }}</text>
            <text class="u-text">{{ t("repayCallbackDesc") }}</text>
          </view>
        </view>
      </view>
    </NeoCard>

    <!-- Warning -->
    <view class="warning-box">
      <AppIcon name="alert-triangle" :size="20" />
      <text class="warning-text">{{ t("warningText") }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { NeoCard, AppIcon } from "@shared/components";

defineProps<{
  t: (key: string, ...args: unknown[]) => string;
  contractAddress?: string | null;
  networkLabel?: string;
}>();
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;

.docs-container {
  display: flex;
  flex-direction: column;
  gap: $spacing-4;
  padding-bottom: $spacing-8;
}

.hero-doc {
  padding: $spacing-2;
}

.doc-subtitle {
  font-weight: $font-weight-black;
  font-size: 16px;
  display: block;
  margin-bottom: $spacing-2;
  text-transform: uppercase;
}

.doc-description {
  font-size: 13px;
  line-height: 1.6;
  opacity: 0.8;
}

.info-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: $spacing-4;
}

.info-item {
  display: flex;
  flex-direction: column;
}

.info-label {
  font-size: 10px;
  font-weight: $font-weight-black;
  text-transform: uppercase;
  opacity: 0.5;
  margin-bottom: 2px;
}

.info-value {
  font-size: 13px;
  font-weight: $font-weight-black;

  &.mono {
    font-family: $font-mono;
  }
  &.highlight {
    color: var(--neo-green);
    background: var(--flash-code-bg);
    padding: 2px 6px;
    display: inline-block;
    align-self: flex-start;
  }
}

.hash-box {
  background: var(--bg-elevated);
  border: 1px solid var(--border-color);
  padding: $spacing-3;
  color: var(--text-primary);
}

.hash-value {
  margin-top: 4px;
}

.mono-small {
  font-family: $font-mono;
  font-size: 11px;
  word-break: break-all;
}

.method-card {
  padding: $spacing-4;
  background: var(--bg-elevated);
  border: 2px solid var(--border-color);
  margin-bottom: $spacing-4;
  color: var(--text-primary);
  &:last-child {
    margin-bottom: 0;
  }
}

.method-header {
  display: flex;
  align-items: center;
  gap: $spacing-3;
  margin-bottom: $spacing-2;
}

.method-name {
  font-family: $font-mono;
  font-weight: $font-weight-black;
  font-size: 15px;
  color: var(--neo-purple);
}

.method-badge {
  font-size: 9px;
  font-weight: $font-weight-black;
  padding: 2px 8px;
  border: 1px solid var(--flash-badge-border);
  text-transform: uppercase;

  &.write {
    background: var(--brutal-yellow);
  }
  &.read {
    background: var(--neo-green);
  }
}

.method-desc {
  font-size: 12px;
  opacity: 0.7;
  margin-bottom: $spacing-3;
  display: block;
}

.method-params {
  background: var(--flash-code-bg);
  color: var(--text-primary);
  padding: $spacing-3;
}

.params-title {
  font-size: 9px;
  font-weight: $font-weight-black;
  opacity: 0.6;
  display: block;
  margin-bottom: $spacing-2;
}

.param-item {
  display: flex;
  gap: $spacing-2;
  margin-bottom: 4px;
  font-size: 11px;
}

.param-name {
  color: var(--neo-green);
  font-family: $font-mono;
  min-width: 80px;
}
.param-type {
  color: var(--brutal-yellow);
  font-family: $font-mono;
  min-width: 60px;
}
.param-desc {
  opacity: 0.6;
  flex: 1;
}

.usage-steps {
  display: flex;
  flex-direction: column;
  gap: $spacing-4;
}

.u-step {
  display: flex;
  gap: $spacing-4;
}

.u-num {
  font-family: $font-mono;
  font-size: 20px;
  font-weight: $font-weight-black;
  color: var(--neo-green);
  opacity: 0.3;
}

.u-title {
  display: block;
  font-size: 14px;
  font-weight: $font-weight-black;
  text-transform: uppercase;
  margin-bottom: 2px;
}

.u-text {
  font-size: 11px;
  line-height: 1.4;
  opacity: 0.7;
  display: block;
}

.warning-box {
  background: var(--flash-warning-box-bg);
  border: 2px solid var(--flash-warning-box-border);
  padding: $spacing-4;
  display: flex;
  gap: $spacing-3;
  align-items: flex-start;
}

.warning-text {
  font-size: 11px;
  font-weight: $font-weight-bold;
  color: var(--flash-warning-box-text);
}

.mt-4 {
  margin-top: $spacing-4;
}
</style>
