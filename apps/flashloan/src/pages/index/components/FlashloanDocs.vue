<template>
  <div class="docs-container">
    <NeoCard :title="t('docTitle')" variant="accent" class="mb-4">
      <div class="hero-doc">
        <span class="doc-subtitle">{{ t("docSubtitle") }}</span>
        <span class="doc-description">{{ t("docDescription") }}</span>
      </div>
    </NeoCard>

    <!-- Contract Info -->
    <NeoCard :title="t('contractInfo')" class="mb-4">
      <div class="info-grid">
        <div class="info-item">
          <span class="info-label">{{ t("contractName") }}</span>
          <span class="info-value mono">MiniAppFlashLoan</span>
        </div>
        <div class="info-item">
          <span class="info-label">{{ t("version") }}</span>
          <span class="info-value">v2.0.0</span>
        </div>
        <div class="info-item">
          <span class="info-label">{{ t("minLoan") }}</span>
          <span class="info-value">1 GAS</span>
        </div>
        <div class="info-item">
          <span class="info-label">{{ t("maxLoan") }}</span>
          <span class="info-value">100,000 GAS</span>
        </div>
        <div class="info-item">
          <span class="info-label">{{ t("cooldown") }}</span>
          <span class="info-value">5 {{ t("minutes") }}</span>
        </div>
        <div class="info-item">
          <span class="info-label">{{ t("dailyLimit") }}</span>
          <span class="info-value">10 {{ t("loansPerDay") }}</span>
        </div>
        <div class="info-item">
          <span class="info-label">{{ t("network") }}</span>
          <span class="info-value">{{ networkLabel || t("neoN3Network") }}</span>
        </div>
        <div class="info-item">
          <span class="info-label">{{ t("protocolFee") }}</span>
          <span class="info-value highlight">0.09%</span>
        </div>
      </div>

      <div class="hash-box mt-4">
        <span class="info-label">{{ t("contractHash") }}</span>
        <div class="hash-value">
          <span class="mono-small">{{ contractAddress || t("notAvailable") }}</span>
        </div>
      </div>
    </NeoCard>

    <!-- Contract Methods -->
    <NeoCard :title="t('contractMethods')" class="mb-4">
      <div class="method-card">
        <div class="method-header">
          <span class="method-name">RequestLoan</span>
          <span class="method-badge write">{{ t("write") }}</span>
        </div>
        <span class="method-desc">{{ t("requestLoanDesc") }}</span>
        <div class="method-params">
          <span class="params-title">{{ t("parameters") }}:</span>
          <div class="param-item">
            <span class="param-name">borrower</span>
            <span class="param-type">Hash160</span>
            <span class="param-desc">{{ t("borrowerDesc") }}</span>
          </div>
          <div class="param-item">
            <span class="param-name">amount</span>
            <span class="param-type">Integer</span>
            <span class="param-desc">{{ t("amountDesc") }}</span>
          </div>
          <div class="param-item">
            <span class="param-name">callbackContract</span>
            <span class="param-type">Hash160</span>
            <span class="param-desc">{{ t("callbackContractDesc") }}</span>
          </div>
          <div class="param-item">
            <span class="param-name">callbackMethod</span>
            <span class="param-type">String</span>
            <span class="param-desc">{{ t("callbackMethodDesc") }}</span>
          </div>
        </div>
      </div>

      <div class="method-card">
        <div class="method-header">
          <span class="method-name">GetLoan</span>
          <span class="method-badge read">{{ t("read") }}</span>
        </div>
        <span class="method-desc">{{ t("getLoanDesc") }}</span>
        <div class="method-params">
          <span class="params-title">{{ t("parameters") }}:</span>
          <div class="param-item">
            <span class="param-name">loanId</span>
            <span class="param-type">Integer</span>
            <span class="param-desc">{{ t("loanIdentifier") }}</span>
          </div>
        </div>
      </div>

      <div class="method-card">
        <div class="method-header">
          <span class="method-name">GetPoolBalance</span>
          <span class="method-badge read">{{ t("read") }}</span>
        </div>
        <span class="method-desc">{{ t("getPoolBalanceDesc") }}</span>
      </div>

      <div class="method-card">
        <div class="method-header">
          <span class="method-name">Deposit</span>
          <span class="method-badge write">{{ t("write") }}</span>
        </div>
        <span class="method-desc">{{ t("depositDesc") }}</span>
        <div class="method-params">
          <span class="params-title">{{ t("parameters") }}:</span>
          <div class="param-item">
            <span class="param-name">depositor</span>
            <span class="param-type">Hash160</span>
            <span class="param-desc">{{ t("depositorDesc") }}</span>
          </div>
          <div class="param-item">
            <span class="param-name">amount</span>
            <span class="param-type">Integer</span>
            <span class="param-desc">{{ t("amountDesc") }}</span>
          </div>
        </div>
      </div>
    </NeoCard>

    <!-- Usage Steps -->
    <NeoCard :title="t('howToUse')" variant="success" class="mb-4">
      <div class="usage-steps">
        <div class="u-step">
          <div class="u-num">01</div>
          <div class="u-content">
            <span class="u-title">{{ t("deployCallbackTitle") }}</span>
            <span class="u-text">{{ t("deployCallbackDesc") }}</span>
          </div>
        </div>
        <div class="u-step">
          <div class="u-num">02</div>
          <div class="u-content">
            <span class="u-title">{{ t("callRequestLoanTitle") }}</span>
            <span class="u-text">{{ t("callRequestLoanDesc") }}</span>
          </div>
        </div>
        <div class="u-step">
          <div class="u-num">03</div>
          <div class="u-content">
            <span class="u-title">{{ t("teeVerificationTitle") }}</span>
            <span class="u-text">{{ t("teeVerificationDesc") }}</span>
          </div>
        </div>
        <div class="u-step">
          <div class="u-num">04</div>
          <div class="u-content">
            <span class="u-title">{{ t("repayCallbackTitle") }}</span>
            <span class="u-text">{{ t("repayCallbackDesc") }}</span>
          </div>
        </div>
      </div>
    </NeoCard>

    <!-- Warning -->
    <div class="warning-box">
      <AppIcon name="alert-triangle" :size="20" />
      <span class="warning-text">{{ t("warningText") }}</span>
    </div>
  </div>
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
